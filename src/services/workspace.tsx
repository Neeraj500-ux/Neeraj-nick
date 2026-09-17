import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FirebaseError } from "firebase/app";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as updateAuthProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, authPersistenceReady, db, googleProvider } from "../lib/firebase";
import { canManageRole, canManageUser, hasPermission } from "../lib/permissions";
import { normalizeRole, profileFromDocument } from "../lib/profile";
import { demoUsers, seed } from "../lib/seed";
import type { Entity, NotificationPreferences, User } from "../types";

type WorkspaceData = Record<string, Entity[]>;

export type ProfilePatch = Partial<Pick<
  User,
  "name" | "phone" | "job_title" | "department" | "team_id" | "location" | "bio" | "avatar_url"
>> & { notification_preferences?: NotificationPreferences };

type Store = {
  user: User | null;
  data: WorkspaceData;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  demo: (id: string) => void;
  logout: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  save: (table: string, row: Partial<Entity>) => Promise<void>;
  remove: (table: string, id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

type Snapshot = { user: User | null; data: WorkspaceData };

const Context = createContext<Store | undefined>(undefined);
const allowedTables = new Set(Object.keys(seed()));

function isDirector(user: User): boolean {
  return user.role === "director";
}

function storageKey(uid: string): string {
  return `ca-firebase-data:${uid}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(cause: unknown): string {
  if (cause instanceof FirebaseError) {
    const messages: Record<string, string> = {
      "permission-denied": "Firestore denied access to your workspace profile. Check the users document ID and Firestore rules.",
      unavailable: "Cannot reach the workspace server. Check your connection and try again.",
      "failed-precondition": "Firestore is not ready for this project. Check that Cloud Firestore is enabled.",
      "auth/popup-closed-by-user": "Google sign-in was cancelled.",
      "auth/popup-blocked": "Allow popups in your browser and try again.",
      "auth/account-exists-with-different-credential": "Use the sign-in method already linked to this email.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/user-not-found": "Incorrect email or password.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/user-disabled": "This account has been disabled.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
      "auth/network-request-failed": "Check your internet connection and try again.",
      "auth/operation-not-allowed": "Enable Email/Password login in Firebase Authentication.",
      "auth/unauthorized-domain": "Add this domain to Firebase authorized domains.",
      "auth/requires-recent-login": "For security, sign in again before changing your password.",
    };
    return messages[cause.code] ?? `Authentication failed (${cause.code}).`;
  }

  if (typeof DOMException !== "undefined" && cause instanceof DOMException) {
    if (cause.name === "QuotaExceededError" || cause.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      return "Browser storage is full. Your changes were not saved.";
    }
    if (cause.name === "SecurityError") return "Browser storage is unavailable. Check your browser settings.";
  }
  if (cause instanceof SyntaxError) return "Saved workspace data cannot be read. Existing storage was preserved.";
  return cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
}

function readData(uid: string): WorkspaceData {
  const saved = window.localStorage.getItem(storageKey(uid));
  if (saved === null) return seed();

  const parsed: unknown = JSON.parse(saved);
  if (!isObject(parsed)) throw new Error("Saved workspace data is invalid.");
  const result: WorkspaceData = {};

  for (const table of allowedTables) {
    const rows = parsed[table];
    if (rows === undefined) {
      result[table] = [];
      continue;
    }
    if (!Array.isArray(rows)) throw new Error(`Saved "${table}" data is invalid.`);
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isObject(row) || typeof row.id !== "string" || !row.id.trim() || ids.has(row.id)) {
        throw new Error(`Saved "${table}" contains an invalid record.`);
      }
      ids.add(row.id);
    }
    result[table] = rows as Entity[];
  }
  return result;
}

function profileReadError(cause: unknown, uid: string): Error {
  if (cause instanceof FirebaseError) {
    if (cause.code === "permission-denied") {
      return new Error(`Firestore denied access to users/${uid}. Allow the signed-in user to read only this UID document.`);
    }
    if (cause.code === "unavailable") return new Error("Cannot reach Firestore. Check your internet connection and try again.");
  }
  return new Error(getErrorMessage(cause));
}

async function createProfile(firebaseUser: FirebaseUser): Promise<User> {
  const uid = firebaseUser.uid.trim();
  if (!uid) throw new Error("Firebase returned an empty user ID. Please sign in again.");

  let profileDoc;
  try {
    profileDoc = await getDoc(doc(db, "users", uid));
  } catch (cause) {
    throw profileReadError(cause, uid);
  }
  if (!profileDoc.exists()) {
    throw new Error(`Workspace profile not found at users/${uid}. Create a Firestore document with this exact Firebase UID.`);
  }

  const profile = profileFromDocument(uid, firebaseUser.email, profileDoc.data());
  return {
    ...profile,
    id: uid,
    name: profile.name === "Workspace member"
      ? firebaseUser.displayName?.trim() || firebaseUser.email?.split("@")[0] || "Workspace User"
      : profile.name,
  };
}

function validateTable(table: string): void {
  if (!allowedTables.has(table)) throw new Error(`Unknown workspace table: ${table}`);
}

function createActivity(user: User, action: string, table: string, details: unknown): Entity {
  return {
    id: crypto.randomUUID(),
    name: `${user.name} ${action} ${table}`,
    status: "Recorded",
    owner_id: user.id,
    created_at: new Date().toISOString(),
    description: JSON.stringify(details),
  };
}

function assertDataWriteAccess(
  user: User,
  table: string,
  row: Partial<Entity>,
  existing?: Entity,
): void {
  if (table === "activity_logs") throw new Error("Activity history is read-only.");
  if (table === "settings" && !hasPermission(user, "settings.manage")) {
    throw new Error("Only workspace administrators can change company settings.");
  }
  if (["invoices", "payroll", "expenses"].includes(table) && !hasPermission(user, "finance.view")) {
    throw new Error("Finance records are restricted to authorized workspace leaders.");
  }

  if (table === "employees") {
    const targetRole = normalizeRole(row.role ?? existing?.role);
    if (!targetRole) throw new Error("Choose a valid workspace role.");
    const target = {
      id: String(row.id ?? existing?.id ?? "new-user"),
      role: targetRole,
      reports_to: typeof row.reports_to === "string" ? row.reports_to : existing?.reports_to,
      team_id: typeof row.team_id === "string" ? row.team_id : existing?.team_id || "",
    } as const;
    if (existing) {
      if (!canManageUser(user, target)) throw new Error("You can manage only people within your permitted reporting scope.");
    } else if (!canManageRole(user, targetRole)) {
      throw new Error("You do not have permission to create this role.");
    }
  }

  if (["projects", "clients"].includes(table) && !hasPermission(user, "projects.manage")) {
    throw new Error("You do not have permission to change this workspace area.");
  }
  if (table === "tasks" && !hasPermission(user, "tasks.manage") && existing?.assignee !== user.id) {
    throw new Error("You can update only tasks assigned to you.");
  }
  if (table === "files" && !hasPermission(user, "files.manage")) {
    throw new Error("File uploads and changes are restricted to team leads and administrators.");
  }
  if (table === "attendance" && !hasPermission(user, "attendance.manage") && row.assignee !== user.id) {
    throw new Error("You can change only your own attendance.");
  }
}

export function Provider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ user: null, data: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const snapshotRef = useRef(snapshot);
  const mountedRef = useRef(false);
  const authBusyRef = useRef(false);
  const operationVersionRef = useRef(0);
  const demoIdRef = useRef<string | null>(null);

  const publish = useCallback((next: Snapshot) => {
    if (!mountedRef.current) return;
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const reportError = useCallback((cause: unknown): Error => {
    const message = getErrorMessage(cause);
    if (mountedRef.current) setError(message);
    return new Error(message);
  }, []);

  const clearWorkspace = useCallback(() => {
    demoIdRef.current = null;
    publish({ user: null, data: {} });
  }, [publish]);

  const isCurrent = useCallback(
    (version: number) => mountedRef.current && operationVersionRef.current === version,
    [],
  );

  const loadWorkspace = useCallback(async (firebaseUser: FirebaseUser, version: number) => {
    const profile = await createProfile(firebaseUser);
    if (!isCurrent(version) || auth.currentUser?.uid !== firebaseUser.uid) return;
    const records = readData(firebaseUser.uid);
    demoIdRef.current = null;
    publish({ user: profile, data: records });
    setError("");
  }, [isCurrent, publish]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!active || authBusyRef.current) return;
      const version = ++operationVersionRef.current;
      setError("");
      if (!firebaseUser) {
        if (demoIdRef.current && snapshotRef.current.user) {
          setLoading(false);
          return;
        }
        clearWorkspace();
        setLoading(false);
        return;
      }
      clearWorkspace();
      setLoading(true);
      void loadWorkspace(firebaseUser, version)
        .catch((cause) => {
          if (active && isCurrent(version)) {
            clearWorkspace();
            reportError(cause);
          }
        })
        .finally(() => {
          if (active && isCurrent(version)) setLoading(false);
        });
    }, (cause) => {
      if (!active) return;
      ++operationVersionRef.current;
      authBusyRef.current = false;
      clearWorkspace();
      reportError(cause);
      setLoading(false);
    });

    const handleStorage = (event: StorageEvent) => {
      const profile = snapshotRef.current.user;
      if (!active || authBusyRef.current || !profile || event.storageArea !== window.localStorage ||
        (event.key !== null && event.key !== storageKey(profile.id))) return;
      try {
        publish({ user: profile, data: readData(profile.id) });
      } catch (cause) {
        reportError(cause);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      active = false;
      mountedRef.current = false;
      ++operationVersionRef.current;
      authBusyRef.current = false;
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearWorkspace, isCurrent, loadWorkspace, publish, reportError]);

  const authenticate = useCallback(async (method: () => Promise<{ user: FirebaseUser }>) => {
    if (authBusyRef.current) throw reportError(new Error("Another sign-in request is in progress."));
    authBusyRef.current = true;
    const version = ++operationVersionRef.current;
    clearWorkspace();
    setError("");
    setLoading(true);
    try {
      await authPersistenceReady;
      const credential = await method();
      if (isCurrent(version)) await loadWorkspace(credential.user, version);
    } catch (cause) {
      if (isCurrent(version)) {
        clearWorkspace();
        throw reportError(cause);
      }
      throw new Error(getErrorMessage(cause));
    } finally {
      if (isCurrent(version)) {
        authBusyRef.current = false;
        setLoading(false);
      }
    }
  }, [clearWorkspace, isCurrent, loadWorkspace, reportError]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw reportError(new Error("Please enter a valid email address."));
    }
    if (!password) throw reportError(new Error("Please enter your password."));
    await authenticate(() => signInWithEmailAndPassword(auth, cleanEmail, password));
  }, [authenticate, reportError]);

  const loginGoogle = useCallback(async (): Promise<void> => {
    await authenticate(() => signInWithPopup(auth, googleProvider));
  }, [authenticate]);

  const logout = useCallback(async (): Promise<void> => {
    if (authBusyRef.current) throw reportError(new Error("Wait for the current sign-in request to finish."));
    authBusyRef.current = true;
    const version = ++operationVersionRef.current;
    setLoading(true);
    setError("");
    try {
      await signOut(auth);
      if (isCurrent(version)) clearWorkspace();
    } catch (cause) {
      if (isCurrent(version)) throw reportError(cause);
      throw new Error(getErrorMessage(cause));
    } finally {
      if (isCurrent(version)) {
        authBusyRef.current = false;
        setLoading(false);
      }
    }
  }, [clearWorkspace, isCurrent, reportError]);

  const demo = useCallback((id: string): void => {
    if (authBusyRef.current || auth.currentUser) {
      reportError(new Error("Sign out before opening a preview account."));
      return;
    }
    try {
      const profile = demoUsers.find((candidate) => candidate.id === id);
      if (!profile) throw new Error("That preview account does not exist.");
      const records = readData(profile.id);
      ++operationVersionRef.current;
      demoIdRef.current = profile.id;
      publish({ user: profile, data: records });
      setError("");
      setLoading(false);
    } catch (cause) {
      reportError(cause);
    }
  }, [publish, reportError]);

  const refresh = useCallback(async (): Promise<void> => {
    if (authBusyRef.current) throw reportError(new Error("Wait for the current sign-in request to finish."));
    const version = ++operationVersionRef.current;
    setLoading(true);
    try {
      if (auth.currentUser) {
        await loadWorkspace(auth.currentUser, version);
      } else if (demoIdRef.current && snapshotRef.current.user) {
        publish({ user: snapshotRef.current.user, data: readData(demoIdRef.current) });
        setError("");
      } else {
        clearWorkspace();
        setError("");
      }
    } catch (cause) {
      if (isCurrent(version)) {
        clearWorkspace();
        throw reportError(cause);
      }
      throw new Error(getErrorMessage(cause));
    } finally {
      if (isCurrent(version)) setLoading(false);
    }
  }, [clearWorkspace, isCurrent, loadWorkspace, publish, reportError]);

  const requireUser = useCallback((): User => {
    const currentUser = snapshotRef.current.user;
    if (authBusyRef.current || !currentUser ||
      (demoIdRef.current !== currentUser.id && auth.currentUser?.uid !== currentUser.id)) {
      throw new Error("Please sign in before changing workspace data.");
    }
    return currentUser;
  }, []);

  const persist = useCallback((next: WorkspaceData, currentUser: User): void => {
    if (demoIdRef.current !== currentUser.id && auth.currentUser?.uid !== currentUser.id) {
      throw new Error("Your session changed. Please sign in again.");
    }
    window.localStorage.setItem(storageKey(currentUser.id), JSON.stringify(next));
    publish({ user: currentUser, data: next });
    if (mountedRef.current) setError("");
  }, [publish]);

  const save = useCallback(async (table: string, row: Partial<Entity>): Promise<void> => {
    try {
      const currentUser = requireUser();
      validateTable(table);
      if (!isObject(row)) throw new Error("The record must be an object.");
      const id = row.id ?? crypto.randomUUID();
      if (typeof id !== "string" || !id.trim()) throw new Error("The record ID is invalid.");

      const currentData = readData(currentUser.id);
      const rows = currentData[table] ?? [];
      const existing = rows.find((item) => item.id === id);
      assertDataWriteAccess(currentUser, table, row, existing);

      const updates = Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
      const fields: Record<string, unknown> = {
        team_id: currentUser.team_id,
        ...existing,
        ...updates,
        owner_id: existing?.owner_id || currentUser.id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      for (const field of ["assignee", "project_id", "client_id"]) {
        if (fields[field] === "") fields[field] = null;
      }

      const record = { ...fields, id } as Entity;
      const next: WorkspaceData = {
        ...currentData,
        [table]: existing ? rows.map((item) => (item.id === id ? record : item)) : [record, ...rows],
      };

      if (table !== "activity_logs" && allowedTables.has("activity_logs")) {
        next.activity_logs = [
          createActivity(currentUser, existing ? "updated" : "created", table, { before: existing, after: record }),
          ...(next.activity_logs ?? []),
        ];
      }
      if (table === "tasks" && allowedTables.has("notifications")) {
        next.notifications = [
          {
            id: crypto.randomUUID(),
            name: `${String(fields.name || "Task")} · ${String(fields.status || "Updated")}`,
            status: "Unread",
            assignee: fields.assignee ?? null,
            owner_id: currentUser.id,
            created_at: new Date().toISOString(),
          },
          ...(next.notifications ?? []),
        ] as Entity[];
      }
      persist(next, currentUser);
    } catch (cause) {
      throw reportError(cause);
    }
  }, [persist, reportError, requireUser]);

  const remove = useCallback(async (table: string, id: string): Promise<void> => {
    try {
      const currentUser = requireUser();
      validateTable(table);
      if (typeof id !== "string" || !id.trim()) throw new Error("The record ID is invalid.");
      const currentData = readData(currentUser.id);
      const rows = currentData[table] ?? [];
      const existing = rows.find((item) => item.id === id);
      if (!existing) {
        if (mountedRef.current) setError("");
        return;
      }

      if (table === "activity_logs") throw new Error("Activity history is read-only.");
      if (table === "employees") {
        if (existing.role === "director") throw new Error("The Director account cannot be deleted.");
        if (!canManageUser(currentUser, {
          id: existing.id,
          role: existing.role ?? "employee",
          reports_to: existing.reports_to,
          team_id: existing.team_id || "",
        })) throw new Error("You do not have permission to delete this account.");
      }
      if (table === "files" && !hasPermission(currentUser, "files.manage")) {
        throw new Error("You do not have permission to delete files.");
      }
      if (table === "tasks" && !hasPermission(currentUser, "tasks.manage")) {
        throw new Error("Only team leads and administrators can delete tasks.");
      }

      const next: WorkspaceData = {
        ...currentData,
        [table]: rows.filter((item) => item.id !== id),
      };
      if (allowedTables.has("activity_logs")) {
        next.activity_logs = [
          createActivity(currentUser, "deleted", table, { before: existing }),
          ...(next.activity_logs ?? []),
        ];
      }
      persist(next, currentUser);
    } catch (cause) {
      throw reportError(cause);
    }
  }, [persist, reportError, requireUser]);

  const updateProfile = useCallback(async (patch: ProfilePatch): Promise<void> => {
    try {
      const currentUser = requireUser();
      const clean: ProfilePatch = {};
      // These are the only profile fields a signed-in member may edit.
      // Role, permissions, department and team ownership stay administrator-controlled.
      const allowedFields: Array<keyof ProfilePatch> = [
        "name", "phone", "job_title", "location", "bio",
      ];
      for (const field of allowedFields) {
        const value = patch[field];
        if (typeof value === "string") clean[field] = value.trim() as never;
      }
      if (patch.notification_preferences) {
        clean.notification_preferences = {
          ...currentUser.notification_preferences,
          ...patch.notification_preferences,
        } as NotificationPreferences;
      }
      if (clean.name !== undefined && clean.name.length < 2) {
        throw new Error("Your name must contain at least two characters.");
      }

      const firebaseUser = auth.currentUser;
      if (firebaseUser && currentUser.id !== firebaseUser.uid) {
        throw new Error("Your workspace profile is out of sync. Please sign in again.");
      }

      if (Object.keys(clean).length && firebaseUser) {
        await authPersistenceReady;
        // Never use an email, generated document ID, or a local record ID here.
        // Firestore profile path must always be users/<Firebase Authentication UID>.
        await updateDoc(doc(db, "users", firebaseUser.uid.trim()), clean as never);
        if (typeof clean.name === "string" && clean.name !== currentUser.name) {
          await updateAuthProfile(firebaseUser, { displayName: clean.name });
        }
      }

      const nextUser: User = { ...currentUser, ...clean };
      const currentData = readData(currentUser.id);
      const nextData: WorkspaceData = {
        ...currentData,
        employees: (currentData.employees || []).map((row) =>
          row.id === currentUser.id ? { ...row, ...clean, name: nextUser.name } : row,
        ),
      };
      persist(nextData, nextUser);
    } catch (cause) {
      throw reportError(cause);
    }
  }, [persist, reportError, requireUser]);

  const value = useMemo<Store>(() => ({
    user: snapshot.user,
    data: snapshot.data,
    loading,
    error,
    login,
    loginGoogle,
    demo,
    logout,
    updateProfile,
    save,
    remove,
    refresh,
  }), [snapshot, loading, error, login, loginGoogle, demo, logout, updateProfile, save, remove, refresh]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace(): Store {
  const context = useContext(Context);
  if (!context) throw new Error("useWorkspace must be used inside Provider.");
  return context;
}

export function scoped(rows: Entity[], user: User | null): Entity[] {
  if (!user) return [];
  if (isDirector(user)) return rows;
  return rows.filter((row) => {
    if (row.assignee === user.id || row.owner_id === user.id) return true;
    if (user.role === "employee") return false;
    return Boolean(user.team_id && (row.team_id === user.team_id || row.department === user.team_id));
  });
}
