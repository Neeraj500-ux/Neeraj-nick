import type { Permission, Role, User } from "../types";

export const roleLevel: Record<Role, number> = {
  director: 4,
  manager: 3,
  team_lead: 2,
  employee: 1,
};

export const dashboardPath: Record<Role, string> = {
  director: "/director",
  manager: "/manager",
  team_lead: "/team-lead",
  employee: "/employee",
};

const permissionSets: Record<Role, Permission[]> = {
  director: [
    "users.view", "users.create", "users.edit", "users.delete", "roles.manage",
    "projects.view", "projects.manage", "tasks.view", "tasks.manage",
    "attendance.view", "attendance.manage", "reports.view", "finance.view",
    "settings.view", "settings.manage", "files.view", "files.manage",
    "profile.view", "profile.edit", "requests.create", "requests.manage",
    "approvals.view", "approvals.manage", "audit.view",
  ],
  manager: [
    "users.view", "users.create", "users.edit", "projects.view", "projects.manage",
    "tasks.view", "tasks.manage", "attendance.view", "attendance.manage",
    "reports.view", "files.view", "files.manage", "profile.view", "profile.edit",
    "requests.create", "requests.manage", "approvals.view", "approvals.manage",
  ],
  team_lead: [
    "users.view", "users.edit", "projects.view", "projects.manage", "tasks.view",
    "tasks.manage", "attendance.view", "attendance.manage", "reports.view",
    "files.view", "files.manage", "profile.view", "profile.edit", "requests.create",
    "requests.manage", "approvals.view", "approvals.manage",
  ],
  employee: [
    "projects.view", "tasks.view", "attendance.view", "profile.view", "profile.edit",
    "files.view", "requests.create",
  ],
};

export const pathPermissions: Record<string, Permission> = {
  "/people": "users.view",
  "/projects": "projects.view",
  "/tasks": "tasks.view",
  "/clients": "projects.view",
  "/employees": "users.view",
  "/teams": "users.view",
  "/workload": "reports.view",
  "/content_items": "projects.view",
  "/requests": "requests.create",
  "/approvals": "approvals.view",
  "/files": "files.view",
  "/documents": "files.view",
  "/comments": "tasks.view",
  "/reports": "reports.view",
  "/attendance": "attendance.view",
  "/finance": "finance.view",
  "/payroll": "finance.view",
  "/expenses": "finance.view",
  "/notifications": "profile.view",
  "/automations": "settings.manage",
  "/activity_logs": "audit.view",
  "/settings": "settings.view",
  "/profile": "profile.view",
  "/calendar": "tasks.view",
  "/time_entries": "tasks.view",
  "/my-tasks": "tasks.view",
  "/my-projects": "projects.view",
};

export function hasPermission(user: User | null, permission: Permission): boolean {
  return Boolean(user?.active && permissionSets[user.role]?.includes(permission));
}

export function permissionsFor(role: Role): Permission[] {
  return [...permissionSets[role]];
}

export function getDashboardPath(role: Role | string | null | undefined): string {
  return role && Object.prototype.hasOwnProperty.call(dashboardPath, role)
    ? dashboardPath[role as Role]
    : "/login";
}

export function canAccess(user: User | null, roles: Role[]): boolean {
  return Boolean(user?.active && roles.includes(user.role));
}

export function canUsePath(user: User | null, path: string): boolean {
  const required = pathPermissions[path];
  return !required || hasPermission(user, required);
}

export function manageableRoles(role: Role): Role[] {
  if (role === "director") return ["manager", "team_lead", "employee"];
  if (role === "manager") return ["team_lead", "employee"];
  if (role === "team_lead") return ["employee"];
  return [];
}

export function manageableRole(role: Role): Role | null {
  return manageableRoles(role)[0] ?? null;
}

export function canManageRole(actor: User, targetRole: Role): boolean {
  return hasPermission(actor, "users.edit") && manageableRoles(actor.role).includes(targetRole);
}

export function canManageUser(
  actor: User,
  target: Pick<User, "id" | "role" | "reports_to" | "team_id">,
): boolean {
  if (target.id === actor.id || !canManageRole(actor, target.role)) return false;
  if (actor.role === "director") return true;
  return target.reports_to === actor.id || target.team_id === actor.team_id;
}

// Kept as a compatibility helper for the existing People screen.
export function canManage(
  actor: User,
  target: Pick<User, "role" | "reports_to" | "team_id">,
): boolean {
  return canManageRole(actor, target.role) &&
    (actor.role === "director" || target.reports_to === actor.id || target.team_id === actor.team_id);
}
