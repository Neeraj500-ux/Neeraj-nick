import type { NotificationPreferences, Permission, Role, User } from "../types";

const legacyRoleMap: Record<string, Role> = {
  director: "director",
  super_admin: "director",
  owner: "director",
  manager: "manager",
  admin: "manager",
  team_lead: "team_lead",
  team_leader: "team_lead",
  leader: "team_lead",
  employee: "employee",
};

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(legacyRoleMap, key)
    ? legacyRoleMap[key]
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function notificationPreferences(value: unknown): NotificationPreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    email: source.email !== false,
    task_updates: source.task_updates !== false,
    approvals: source.approvals !== false,
    announcements: source.announcements !== false,
  };
}

function permissions(value: unknown): Permission[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is Permission => typeof item === "string") as Permission[];
}

export function profileFromDocument(
  uid: string,
  email: string | null,
  data: Record<string, unknown>,
): User {
  const role = normalizeRole(data.role);
  if (!role) throw new Error("Your assigned role is invalid. Contact your administrator.");
  if (data.active === false) throw new Error("Your workspace access has been disabled.");

  return {
    id: uid,
    email: email ?? stringValue(data.email) ?? "",
    name: stringValue(data.name) ?? "Workspace member",
    role,
    active: true,
    team_id: stringValue(data.team_id) ?? stringValue(data.department) ?? "",
    reports_to: stringValue(data.reports_to),
    phone: stringValue(data.phone),
    joined_at: stringValue(data.joined_at) ?? stringValue(data.joining_date),
    job_title: stringValue(data.job_title),
    department: stringValue(data.department),
    location: stringValue(data.location),
    bio: stringValue(data.bio),
    avatar_url: stringValue(data.avatar_url),
    notification_preferences: notificationPreferences(data.notification_preferences),
    permissions: permissions(data.permissions),
  };
}
