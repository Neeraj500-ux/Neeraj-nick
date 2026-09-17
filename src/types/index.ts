export type Role = "director" | "manager" | "team_lead" | "employee";

export type Permission =
  | "users.view"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "roles.manage"
  | "projects.view"
  | "projects.manage"
  | "tasks.view"
  | "tasks.manage"
  | "attendance.view"
  | "attendance.manage"
  | "reports.view"
  | "finance.view"
  | "settings.view"
  | "settings.manage"
  | "files.view"
  | "files.manage"
  | "profile.view"
  | "profile.edit"
  | "requests.create"
  | "requests.manage"
  | "approvals.view"
  | "approvals.manage"
  | "audit.view";

export type NotificationPreferences = {
  email: boolean;
  task_updates: boolean;
  approvals: boolean;
  announcements: boolean;
};
export type Entity = {
  id: string;
  name: string;
  status: string;
  department?: string;
  email?: string;
  role?: Role;
  assignee?: string;
  project_id?: string;
  client_id?: string;
  due?: string;
  priority?: string;
  hours?: number;
  amount?: number;
  description?: string;
  owner_id?: string;
  team_id?: string;
  reports_to?: string;
  space_id?: string;
  folder_id?: string;
  list_id?: string;
  parent_id?: string;
  goal_id?: string;
  start_date?: string;
  tags?: string[] | string;
  color?: string;
  progress?: number;
  phone?: string;
  job_title?: string;
  location?: string;
  joined_at?: string;
  joining_date?: string;
  bio?: string;
  avatar_url?: string;
  mime_type?: string;
  storage_path?: string;
  size?: number;
  created_at?: string;
  [key: string]: unknown;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  team_id: string;
  active: boolean;
  reports_to?: string;
  phone?: string;
  joined_at?: string;
  job_title?: string;
  department?: string;
  location?: string;
  bio?: string;
  avatar_url?: string;
  notification_preferences?: NotificationPreferences;
  permissions?: Permission[];
};
export const roleLabels: Record<Role, string> = {
  director: "Director",
  manager: "Manager",
  team_lead: "Team Lead",
  employee: "Employee",
};
export const roleDescriptions: Record<Role, string> = {
  director: "Organization-wide direction and control",
  manager: "Department delivery and team leadership",
  team_lead: "Team execution and daily momentum",
  employee: "Focused work, progress and growth",
};
export const roleAccents: Record<Role, string> = {
  director: "violet",
  manager: "blue",
  team_lead: "teal",
  employee: "amber",
};
export const statuses = [
  "To Do",
  "In Progress",
  "Internal Review",
  "Revision",
  "Completed",
];
export const departments = [
  "Creative",
  "Performance Marketing",
  "Development",
  "Content",
  "Client Servicing",
];
