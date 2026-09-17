import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  ClipboardCheck,
  Command,
  FileText,
  FolderKanban,
  Gauge,
  HelpCircle,
  KanbanSquare,
  LayoutDashboard,
  List as ListIcon,
  Loader2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Avatar, Badge, Button, Empty, Modal } from "../components/ui";
import { scoped, useWorkspace } from "../services/workspace";
import { departments, statuses, type Entity } from "../types";
import { exportCSV } from "../lib/csv";
import { TaskPanel } from "../components/TaskPanel";
 
type DirectorView = "overview" | "list" | "board" | "calendar" | "timeline" | "workload";
type ComposerKind =
  | "task"
  | "project"
  | "client"
  | "employee"
  | "manager"
  | "team_lead"
  | "department"
  | "team";

type ManagementKind = Exclude<ComposerKind, "task" | "project">;
type WorkComposerKind = Extract<ComposerKind, "task" | "project">;

type ComposerForm = {
  name: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  projectId: string;
  clientId: string;
  due: string;
  startDate: string;
  hours: string;
  amount: string;
  department: string;
  spaceId: string;
  tags: string;
};

type Metric = {
  label: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
  tone: string;
  href: string;
};

type TeamLoad = {
  person: Entity;
  hours: number;
  open: number;
  percent: number;
};

type ManagementForm = {
  name: string;
  company: string;
  email: string;
  phone: string;
  profileImage: string;
  industry: string;
  address: string;
  city: string;
  country: string;
  status: string;
  leadSource: string;
  startDate: string;
  endDate: string;
  budget: string;
  paymentStatus: string;
  notes: string;
  role: string;
  department: string;
  team: string;
  manager: string;
  teamLead: string;
  joiningDate: string;
  employmentStatus: string;
  invitationStatus: string;
  portalAccess: string;
  permissions: string;
  assignedProjects: string;
  color: string;
  description: string;
};

type ToastState = {
  tone: "success" | "error";
  message: string;
};

type WorkspaceRecords = Record<string, Entity[] | undefined>;

const DEFAULT_SPACES: Entity[] = departments.map((name, index) => ({
  id: "space-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  status: "Active",
  color: ["#8b5cf6", "#2563eb", "#0f9f93", "#f59e0b", "#ec4899"][index] || "#2563eb",
  description: name + " delivery space",
}));

const viewOptions: Array<{ id: DirectorView; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "list", label: "List", icon: ListIcon },
  { id: "board", label: "Board", icon: KanbanSquare },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "timeline", label: "Timeline", icon: BarChart3 },
  { id: "workload", label: "Workload", icon: Users },
];

const projectStatuses = ["Planning", "Active", "At Risk", "On Hold", "Completed"];

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function rowsFrom(data: unknown, key: string): Entity[] {
  const value = (data as WorkspaceRecords | null | undefined)?.[key];
  return Array.isArray(value) ? value : [];
}

function normalizedStatus(value: unknown): string {
  return stringValue(value).trim().toLowerCase().replace(/[_-]+/g, " ");
}

function isActiveEntity(row: Entity): boolean {
  return !["inactive", "archived", "deleted", "disabled", "closed"].includes(normalizedStatus(row.status));
}

function isApproved(row: Entity): boolean {
  return ["approved", "completed", "accepted", "paid"].includes(normalizedStatus(row.status));
}

function activeClientsNote(clients: Entity[]): string {
  return clients.filter(isActiveEntity).length + " currently active";
}

function roleLabel(value: unknown): string {
  const role = normalizedStatus(value);
  if (role === "team lead" || role === "team leader") return "Team Lead";
  if (role === "super admin") return "Super Admin";
  if (!role) return "Team member";
  return role.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relationId(row: Entity, ...keys: string[]): string {
  const source = row as Record<string, unknown>;
  for (const key of keys) {
    const value = source[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return "";
}

function fieldValue(row: Entity | undefined, ...keys: string[]): string {
  return row ? relationId(row, ...keys) : "";
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message;
  return "Something went wrong. Please try again.";
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "creative";
}

function dateFromValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object" && value !== null) {
    const timestamp = value as { toDate?: () => unknown; seconds?: number };
    if (typeof timestamp.toDate === "function") {
      const date = dateFromValue(timestamp.toDate());
      if (date) return date;
    }
    if (typeof timestamp.seconds === "number") {
      const date = new Date(timestamp.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  if (typeof value !== "string" || !value.trim()) return null;
  const input = value.trim();
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input) ? input + "T00:00:00" : input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateKey(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function dateKey(value?: unknown): string {
  const date = dateFromValue(value);
  return date ? localDateKey(date) : "";
}

function dateAtLocalMidnight(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(key + "T00:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDaysKey(key: string, days: number): string {
  const date = dateAtLocalMidnight(key);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function dateLabel(value?: unknown): string {
  const key = dateKey(value);
  if (!key) return "No date";

  const today = localDateKey();
  if (key === today) return "Today";
  if (key === addDaysKey(today, 1)) return "Tomorrow";
  if (key === addDaysKey(today, -1)) return "Yesterday";

  const date = dateAtLocalMidnight(key);
  return date
    ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : key;
}

function fullDateLabel(value?: unknown): string {
  const key = dateKey(value);
  if (!key) return "No deadline";
  const date = dateAtLocalMidnight(key);
  return date
    ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : key;
}

function relativeDueLabel(value?: unknown, today = localDateKey()): string {
  const key = dateKey(value);
  if (!key) return "No date";
  if (key === today) return "Today";

  const current = dateAtLocalMidnight(today);
  const due = dateAtLocalMidnight(key);
  if (!current || !due) return dateLabel(value);

  const difference = Math.round((due.getTime() - current.getTime()) / 86400000);
  if (difference > 0 && difference <= 6) return difference + "d left";
  if (difference < 0 && difference >= -6) return Math.abs(difference) + "d late";
  return dateLabel(value);
}

function currency(value: unknown): string {
  const amount = Number(value || 0);
  return "₹" + (Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function numberValue(value: unknown): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function tagsFor(row: Partial<Entity>): string[] {
  if (Array.isArray(row.tags)) return row.tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  if (typeof row.tags === "string") return row.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function isOverdue(row: Entity, today = localDateKey()): boolean {
  const due = dateKey(row.due);
  return row.status !== "Completed" && Boolean(due) && due < today;
}

function priorityWeight(value?: unknown): number {
  return ({ Urgent: 4, High: 3, Medium: 2, Low: 1 } as Record<string, number>)[stringValue(value)] || 0;
}

function progressFor(projectId: string, tasks: Entity[]): number {
  const related = tasks.filter((task) => stringValue(task.project_id) === projectId);
  if (!related.length) return 0;
  return Math.round((related.filter((task) => task.status === "Completed").length / related.length) * 100);
}

function resolveSpaceId(row: Entity, projects: Map<string, Entity>): string {
  const projectSpace = row.project_id ? projects.get(stringValue(row.project_id))?.space_id : undefined;
  return stringValue(row.space_id || projectSpace || "space-" + slug(stringValue(row.department || row.team_id || "Creative")));
}

function initialsColor(space: Entity): string {
  return typeof space.color === "string" && space.color ? space.color : "#2563eb";
}

function entityName(row?: Entity): string {
  if (!row) return "Unnamed";
  return stringValue(row.name || row.title || row.email || "Unnamed");
}

function compareTasks(a: Entity, b: Entity): number {
  const completionOrder = Number(a.status === "Completed") - Number(b.status === "Completed");
  if (completionOrder !== 0) return completionOrder;
  const priorityOrder = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (priorityOrder !== 0) return priorityOrder;
  const overdueOrder = Number(isOverdue(b)) - Number(isOverdue(a));
  if (overdueOrder !== 0) return overdueOrder;
  return dateKey(a.due).localeCompare(dateKey(b.due)) || entityName(a).localeCompare(entityName(b));
}

function statusProgress(status: unknown): number {
  const value = stringValue(status);
  if (value === "Completed") return 100;
  if (value === "Internal Review") return 82;
  if (value === "Revision") return 70;
  if (value === "In Progress") return 58;
  return 18;
}

function DirectorLoadingState() {
  return (
    <div className="director-page director-loading-state" aria-busy="true" aria-label="Loading director workspace">
      <div className="director-loading-hero">
        <span className="director-loading-line director-loading-kicker" />
        <span className="director-loading-line director-loading-title" />
        <span className="director-loading-line director-loading-copy" />
      </div>
      <div className="director-kpi-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="director-kpi director-loading-card" key={index}>
            <span className="director-loading-line director-loading-icon" />
            <span className="director-loading-line director-loading-small" />
            <span className="director-loading-line director-loading-number" />
            <span className="director-loading-line director-loading-note" />
          </div>
        ))}
      </div>
      <div className="director-card director-loading-panel">
        <span className="director-loading-line director-loading-heading" />
        <span className="director-loading-line director-loading-row" />
        <span className="director-loading-line director-loading-row" />
        <span className="director-loading-line director-loading-row" />
      </div>
    </div>
  );
}

function DirectorComposer({
  kind,
  row,
  spaces,
  defaultSpaceId,
  onClose,
  onSaved,
  onFailed,
}: {
  kind: WorkComposerKind;
  row?: Entity;
  spaces: Entity[];
  defaultSpaceId: string;
  onClose: () => void;
  onSaved?: (message: string) => void;
  onFailed?: (message: string) => void;
}) {
  const { data, user, save } = useWorkspace();
  const people = data.employees || [];
  const projects = data.projects || [];
  const clients = data.clients || [];
  const existingSpace = stringValue(row?.space_id || defaultSpaceId || spaces[0]?.id);
  const existingSpaceName =
    spaces.find((space) => space.id === existingSpace)?.name ||
    stringValue(row?.department) ||
    departments[0] ||
    "Creative";

  const [form, setForm] = useState<ComposerForm>(() => ({
    name: stringValue(row?.name),
    description: stringValue(row?.description),
    status: stringValue(row?.status || (kind === "task" ? "To Do" : "Planning")),
    priority: stringValue(row?.priority || "Medium"),
    assignee: row?.assignee ? stringValue(row.assignee) : stringValue(user?.id),
    projectId: row?.project_id ? stringValue(row.project_id) : "",
    clientId: row?.client_id ? stringValue(row.client_id) : "",
    due: dateKey(row?.due),
    startDate: dateKey(row?.start_date),
    hours: row?.hours ? stringValue(row.hours) : "",
    amount: row?.amount ? stringValue(row.amount) : "",
    department: stringValue(row?.department || existingSpaceName),
    spaceId: existingSpace,
    tags: tagsFor(row || {}).join(", "),
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field: keyof ComposerForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const hours = form.hours.trim() ? Number(form.hours) : 0;
    const amount = form.amount.trim() ? Number(form.amount) : 0;

    if (name.length < 2) {
      setError("Enter a name with at least two characters.");
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Estimated hours must be a valid positive number.");
      return;
    }
    if (kind === "project" && (!Number.isFinite(amount) || amount < 0)) {
      setError("Budget must be a valid positive number.");
      return;
    }
    if (form.startDate && form.due && form.startDate > form.due) {
      setError("Start date cannot be after the due date.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const space = spaces.find((item) => item.id === form.spaceId);
      const folder = (data.folders || []).find((item) => item.space_id === form.spaceId);
      const list = (data.lists || []).find((item) => item.space_id === form.spaceId);
      const common = {
        id: row?.id,
        name,
        description: form.description.trim(),
        assignee: form.assignee || undefined,
        client_id: form.clientId || undefined,
        due: form.due || undefined,
        department: form.department,
        team_id: form.department,
        space_id: form.spaceId || space?.id,
        folder_id: folder?.id,
        list_id: list?.id,
        hours,
      };

      if (kind === "task") {
        await save("tasks", {
          ...common,
          status: form.status,
          priority: form.priority,
          project_id: form.projectId || undefined,
          start_date: form.startDate || undefined,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        });
      } else {
        await save("projects", {
          ...common,
          status: form.status,
          amount,
        });
      }

      try {
        await save("activity_logs", {
          name: row ? "Work item updated" : "Work item created",
          description: (row ? "Updated " : "Created ") + name + " in Creative Adhyayan.",
          actor_id: user?.id,
          created_by: user?.id,
          entity_type: kind,
          entity_id: row?.id,
          created_at: new Date().toISOString(),
        });
      } catch {
        // The primary write succeeded. Audit logging must not turn a valid
        // task/project save into a false error state.
      }

      onSaved?.((row ? "Updated " : "Created ") + kind + " successfully.");
      onClose();
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      onFailed?.(message);
    } finally {
      setBusy(false);
    }
  }

  const baseStatusOptions = kind === "task" ? statuses : projectStatuses;
  const statusOptions = Array.from(new Set([...baseStatusOptions, form.status].filter(Boolean)));
  const departmentOptions = Array.from(new Set([...departments, form.department].filter(Boolean)));

  return (
    <Modal title={(row ? "Edit " : "Create ") + kind} onClose={busy ? () => undefined : onClose}>
      <form className="director-form" onSubmit={submit} aria-busy={busy}>
        <div className="director-form-intro">
          <span className="director-form-icon">
            {kind === "task" ? <CheckCircle2 size={18} /> : <FolderKanban size={18} />}
          </span>
          <span>
            <strong>{row ? "Keep the workspace moving" : "Turn an idea into visible work"}</strong>
            <small>{kind === "task" ? "Give the team a clear next action." : "Set the owner, timeline and delivery space."}</small>
          </span>
        </div>

        <label className="director-field director-field-wide">
          {kind === "task" ? "Task name" : "Project name"} *
          <input
            autoFocus
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder={kind === "task" ? "e.g. Approve the September campaign" : "e.g. New client launch"}
          />
        </label>

        <label className="director-field director-field-wide">
          Brief / description
          <textarea
            rows={3}
            maxLength={500}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Add context, outcome and handoff notes…"
          />
        </label>

        <div className="director-form-grid">
          <label className="director-field">
            Status
            <select value={form.status} onChange={(event) => update("status", event.target.value)}>
              {statusOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>

          {kind === "task" && (
            <label className="director-field">
              Priority
              <select value={form.priority} onChange={(event) => update("priority", event.target.value)}>
                {["Low", "Medium", "High", "Urgent"].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          )}

          <label className="director-field">
            Space
            <select value={form.spaceId} onChange={(event) => update("spaceId", event.target.value)}>
              {!spaces.length && <option value="">No space</option>}
              {spaces.map((space) => <option value={space.id} key={space.id}>{entityName(space)}</option>)}
            </select>
          </label>

          <label className="director-field">
            Department
            <select value={form.department} onChange={(event) => update("department", event.target.value)}>
              {departmentOptions.map((department) => <option key={department}>{department}</option>)}
            </select>
          </label>

          <label className="director-field">
            {kind === "task" ? "Assignee" : "Project owner"}
            <select value={form.assignee} onChange={(event) => update("assignee", event.target.value)}>
              <option value="">Unassigned</option>
              {people.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}
            </select>
          </label>

          <label className="director-field">
            {kind === "task" ? "Project" : "Client"}
            <select
              value={kind === "task" ? form.projectId : form.clientId}
              onChange={(event) => update(kind === "task" ? "projectId" : "clientId", event.target.value)}
            >
              <option value="">No {kind === "task" ? "project" : "client"}</option>
              {(kind === "task" ? projects : clients).map((item) => (
                <option value={item.id} key={item.id}>{entityName(item)}</option>
              ))}
            </select>
          </label>

          {kind === "task" && (
            <label className="director-field">
              Client
              <select value={form.clientId} onChange={(event) => update("clientId", event.target.value)}>
                <option value="">No client</option>
                {clients.map((client) => <option value={client.id} key={client.id}>{entityName(client)}</option>)}
              </select>
            </label>
          )}

          <label className="director-field">
            Start date
            <input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
          </label>

          <label className="director-field">
            Due date
            <input type="date" value={form.due} onChange={(event) => update("due", event.target.value)} />
          </label>

          <label className="director-field">
            Estimated hours
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.hours}
              onChange={(event) => update("hours", event.target.value)}
              placeholder="0"
            />
          </label>

          {kind === "project" && (
            <label className="director-field">
              Budget (₹)
              <input
                type="number"
                min="0"
                step="100"
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
                placeholder="0"
              />
            </label>
          )}

          {kind === "task" && (
            <label className="director-field director-field-wide">
              Tags <span className="director-label-note">comma separated</span>
              <input
                value={form.tags}
                onChange={(event) => update("tags", event.target.value)}
                placeholder="Client delivery, Focus"
              />
            </label>
          )}
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="director-form-actions">
          <Button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? <Loader2 className="director-spin" size={16} /> : <CheckCircle2 size={16} />}
            {busy ? "Saving…" : row ? "Save changes" : "Create " + kind}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ManagementComposer({
  kind,
  row,
  spaces,
  onClose,
  onSaved,
  onFailed,
}: {
  kind: ManagementKind;
  row?: Entity;
  spaces: Entity[];
  onClose: () => void;
  onSaved?: (message: string) => void;
  onFailed?: (message: string) => void;
}) {
  const { data, user, save } = useWorkspace();
  const employees = rowsFrom(data, "employees");
  const projects = rowsFrom(data, "projects");
  const teams = rowsFrom(data, "teams");
  const departmentRows = rowsFrom(data, "departments");
  const activePeople = employees.filter(isActiveEntity);
  const managers = activePeople.filter((person) =>
    ["director", "manager", "super admin", "admin"].includes(normalizedStatus(person.role)),
  );
  const teamLeads = activePeople.filter((person) =>
    ["team lead", "team leader", "manager"].includes(normalizedStatus(person.role)),
  );
  const departmentOptions = Array.from(new Set([
    ...departments,
    ...spaces.map((space) => entityName(space)),
    ...departmentRows.map((department) => entityName(department)),
  ].filter(Boolean)));
  const teamOptions = teams.filter(isActiveEntity);
  const client = kind === "client";
  const organization = kind === "department" || kind === "team";
  const userKind = !client && !organization;
  const fixedRole = kind === "manager" ? "manager" : kind === "team_lead" ? "team_lead" : "employee";
  const label = kind === "team_lead" ? "Team Lead" : kind.charAt(0).toUpperCase() + kind.slice(1);

  const [form, setForm] = useState<ManagementForm>(() => ({
    name: fieldValue(row, "name", "title", "full_name"),
    company: fieldValue(row, "company", "company_name"),
    email: fieldValue(row, "email"),
    phone: fieldValue(row, "phone", "mobile"),
    profileImage: fieldValue(row, "profile_image", "avatar", "photo_url", "image"),
    industry: fieldValue(row, "industry"),
    address: fieldValue(row, "address"),
    city: fieldValue(row, "city"),
    country: fieldValue(row, "country") || "India",
    status: fieldValue(row, "status") || "Active",
    leadSource: fieldValue(row, "lead_source"),
    startDate: dateKey(fieldValue(row, "contract_start_date", "start_date")),
    endDate: dateKey(fieldValue(row, "contract_end_date", "end_date")),
    budget: fieldValue(row, "budget", "amount"),
    paymentStatus: fieldValue(row, "payment_status") || "Pending",
    notes: fieldValue(row, "notes", "description"),
    role: fieldValue(row, "role") || (userKind ? fixedRole : ""),
    department: fieldValue(row, "department", "department_id") || departmentOptions[0] || "",
    team: fieldValue(row, "team", "team_id"),
    manager: fieldValue(row, "manager_id", "manager", "reporting_manager_id"),
    teamLead: fieldValue(row, "team_lead_id", "team_lead"),
    joiningDate: dateKey(fieldValue(row, "joining_date", "join_date")),
    employmentStatus: fieldValue(row, "employment_status") || "Active",
    invitationStatus: fieldValue(row, "invitation_status") || "Pending",
    portalAccess: fieldValue(row, "client_portal_access", "portal_access") || "No",
    permissions: stringList((row as Record<string, unknown> | undefined)?.permissions).join(", "),
    assignedProjects: stringList((row as Record<string, unknown> | undefined)?.assigned_projects || (row as Record<string, unknown> | undefined)?.project_ids).join(", "),
    color: fieldValue(row, "color") || "#38BDF8",
    description: fieldValue(row, "description", "notes"),
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field: keyof ManagementForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const budget = form.budget.trim() ? Number(form.budget) : 0;
    if (name.length < 2) {
      setError("Enter a name with at least two characters.");
      return;
    }
    if ((client || userKind) && !form.email.trim()) {
      setError("Email is required for this record.");
      return;
    }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!Number.isFinite(budget) || budget < 0) {
      setError("Budget must be a valid positive number.");
      return;
    }
    if (form.startDate && form.endDate && form.startDate > form.endDate) {
      setError("Contract start date cannot be after the end date.");
      return;
    }

    setBusy(true);
    setError("");
    const collection = client ? "clients" : userKind ? "employees" : kind === "department" ? "departments" : "teams";
    const role = (userKind ? (form.role || fixedRole) : undefined) as Entity["role"];
    const shared = {
      ...(row || {}),
      id: row?.id,
      name,
      status: form.status || "Active",
      description: form.description.trim() || form.notes.trim(),
      updated_at: new Date().toISOString(),
      updated_by: user?.id,
    };
    const payload = client
      ? {
          ...shared,
          company: form.company.trim(),
          company_name: form.company.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          profile_image: form.profileImage.trim() || undefined,
          industry: form.industry.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
          lead_source: form.leadSource.trim(),
          contract_start_date: form.startDate || undefined,
          contract_end_date: form.endDate || undefined,
          budget,
          payment_status: form.paymentStatus,
          manager_id: form.manager || undefined,
          team_lead_id: form.teamLead || undefined,
          team_id: form.team || undefined,
          assigned_projects: stringList(form.assignedProjects),
          client_portal_access: form.portalAccess === "Yes",
          invitation_status: form.invitationStatus,
          permissions: stringList(form.permissions),
          notes: form.notes.trim(),
          created_by: fieldValue(row, "created_by") || user?.id,
          created_at: fieldValue(row, "created_at") || new Date().toISOString(),
        }
      : userKind
        ? {
            ...shared,
            email: form.email.trim(),
            phone: form.phone.trim(),
            profile_image: form.profileImage.trim() || undefined,
            role,
            department: form.department,
            department_id: form.department,
            team: form.team,
            team_id: form.team,
            manager: form.manager,
            manager_id: form.manager || undefined,
            joining_date: form.joiningDate || undefined,
            employment_status: form.employmentStatus,
            invitation_status: form.invitationStatus,
            assigned_projects: stringList(form.assignedProjects),
            permissions: stringList(form.permissions),
            notes: form.notes.trim(),
            created_by: fieldValue(row, "created_by") || user?.id,
            created_at: fieldValue(row, "created_at") || new Date().toISOString(),
          }
        : {
            ...shared,
            department: kind === "team" ? form.department : undefined,
            department_id: kind === "team" ? form.department : undefined,
            manager_id: form.manager || undefined,
            team_lead_id: kind === "team" ? form.teamLead || undefined : undefined,
            color: form.color,
            created_by: fieldValue(row, "created_by") || user?.id,
            created_at: fieldValue(row, "created_at") || new Date().toISOString(),
          };

    try {
      await save(collection, payload);
      try {
        await save("activity_logs", {
          name: row ? label + " updated" : label + " added",
          description: (row ? "Updated " : "Added ") + name + " in Creative Adhyayan.",
          actor_id: user?.id,
          created_by: user?.id,
          entity_type: collection,
          entity_id: row?.id,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Keep the successful primary write successful if audit logging is unavailable.
      }
      onSaved?.((row ? "Updated " : "Added ") + label + " successfully.");
      onClose();
    } catch (cause) {
      const message = errorMessage(cause);
      setError(message);
      onFailed?.(message);
    } finally {
      setBusy(false);
    }
  }

  const title = row ? "Edit " + label : "Add " + label;
  const statusOptions = client
    ? ["Lead", "Active", "At Risk", "Inactive", "Archived"]
    : ["Active", "Inactive", "Archived"];

  return (
    <Modal title={title} onClose={busy ? () => undefined : onClose}>
      <form className="director-form director-management-form" onSubmit={submit} aria-busy={busy}>
        <div className="director-form-intro">
          <span className="director-form-icon">
            {client ? <BriefcaseBusiness size={18} /> : organization ? <Building2 size={18} /> : <UserPlus size={18} />}
          </span>
          <span>
            <strong>{row ? "Keep the record accurate" : "Add it to the live workspace"}</strong>
            <small>Saved records appear immediately across the Director workspace.</small>
          </span>
        </div>

        {client && (
          <>
            <div className="director-form-section-heading"><span>01</span><div><strong>Basic information</strong><small>Make the relationship easy to understand.</small></div></div>
            <div className="director-form-grid">
              <label className="director-field">Client name *<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Client full name" /></label>
              <label className="director-field">Company name<input value={form.company} onChange={(event) => update("company", event.target.value)} placeholder="Company or brand" /></label>
              <label className="director-field">Email *<input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@company.com" /></label>
              <label className="director-field">Phone<input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 43210" /></label>
              <label className="director-field director-field-wide">Profile image URL<input type="url" value={form.profileImage} onChange={(event) => update("profileImage", event.target.value)} placeholder="https://…" /></label>
              <label className="director-field">Industry<input value={form.industry} onChange={(event) => update("industry", event.target.value)} placeholder="Technology, retail…" /></label>
              <label className="director-field">Address<input value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Street and locality" /></label>
              <label className="director-field">City<input value={form.city} onChange={(event) => update("city", event.target.value)} placeholder="City" /></label>
              <label className="director-field">Country<input value={form.country} onChange={(event) => update("country", event.target.value)} placeholder="Country" /></label>
            </div>

            <div className="director-form-section-heading"><span>02</span><div><strong>Business information</strong><small>Track status, dates and commercial context.</small></div></div>
            <div className="director-form-grid">
              <label className="director-field">Client status<select value={form.status} onChange={(event) => update("status", event.target.value)}>{Array.from(new Set([...statusOptions, form.status].filter(Boolean))).map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field">Lead source<input value={form.leadSource} onChange={(event) => update("leadSource", event.target.value)} placeholder="Referral, website…" /></label>
              <label className="director-field">Contract start<input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></label>
              <label className="director-field">Contract end<input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></label>
              <label className="director-field">Budget (₹)<input type="number" min="0" step="100" value={form.budget} onChange={(event) => update("budget", event.target.value)} placeholder="0" /></label>
              <label className="director-field">Payment status<select value={form.paymentStatus} onChange={(event) => update("paymentStatus", event.target.value)}>{["Pending", "Partial", "Paid", "Overdue"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field director-field-wide">Notes<textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Important relationship notes…" /></label>
            </div>

            <div className="director-form-section-heading"><span>03</span><div><strong>Assignment and access</strong><small>Connect the client to the right delivery team.</small></div></div>
            <div className="director-form-grid">
              <label className="director-field">Assigned manager<select value={form.manager} onChange={(event) => update("manager", event.target.value)}><option value="">Unassigned</option>{managers.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}</select></label>
              <label className="director-field">Assigned team lead<select value={form.teamLead} onChange={(event) => update("teamLead", event.target.value)}><option value="">Unassigned</option>{teamLeads.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}</select></label>
              <label className="director-field">Assigned team<select value={form.team} onChange={(event) => update("team", event.target.value)}><option value="">Unassigned</option>{teamOptions.map((team) => <option value={team.id} key={team.id}>{entityName(team)}</option>)}</select></label>
              <label className="director-field">Portal access<select value={form.portalAccess} onChange={(event) => update("portalAccess", event.target.value)}>{["No", "Yes"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field">Invitation status<select value={form.invitationStatus} onChange={(event) => update("invitationStatus", event.target.value)}>{["Pending", "Sent", "Accepted", "Not required"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field director-field-wide">Assigned project IDs / names<input value={form.assignedProjects} onChange={(event) => update("assignedProjects", event.target.value)} placeholder="Separate multiple items with commas" /></label>
              <label className="director-field director-field-wide">Client permissions<input value={form.permissions} onChange={(event) => update("permissions", event.target.value)} placeholder="comments, feedback, approvals" /></label>
            </div>
          </>
        )}

        {userKind && (
          <>
            <div className="director-form-section-heading"><span>01</span><div><strong>Profile and role</strong><small>Set the person’s identity and access level.</small></div></div>
            <div className="director-form-grid">
              <label className="director-field">Full name *<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Full name" /></label>
              <label className="director-field">Email *<input required type="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@creativeadhyayan.com" /></label>
              <label className="director-field">Phone<input value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 43210" /></label>
              <label className="director-field">Profile image URL<input type="url" value={form.profileImage} onChange={(event) => update("profileImage", event.target.value)} placeholder="https://…" /></label>
              <label className="director-field">Role<select value={form.role || fixedRole} onChange={(event) => update("role", event.target.value)}>{[["manager", "Manager"], ["team_lead", "Team Lead"], ["employee", "Employee"]].map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
              <label className="director-field">Department<select value={form.department} onChange={(event) => update("department", event.target.value)}>{departmentOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field">Team<select value={form.team} onChange={(event) => update("team", event.target.value)}><option value="">Unassigned</option>{teamOptions.map((team) => <option value={team.id} key={team.id}>{entityName(team)}</option>)}</select></label>
              <label className="director-field">Reporting manager<select value={form.manager} onChange={(event) => update("manager", event.target.value)}><option value="">Unassigned</option>{managers.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}</select></label>
            </div>

            <div className="director-form-section-heading"><span>02</span><div><strong>Employment and access</strong><small>Keep people records ready for permission review.</small></div></div>
            <div className="director-form-grid">
              <label className="director-field">Joining date<input type="date" value={form.joiningDate} onChange={(event) => update("joiningDate", event.target.value)} /></label>
              <label className="director-field">Employment status<select value={form.employmentStatus} onChange={(event) => update("employmentStatus", event.target.value)}>{["Active", "Inactive", "On leave", "Archived"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field">Invitation status<select value={form.invitationStatus} onChange={(event) => update("invitationStatus", event.target.value)}>{["Pending", "Sent", "Accepted", "Not required"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field director-field-wide">Assigned project IDs / names<input value={form.assignedProjects} onChange={(event) => update("assignedProjects", event.target.value)} placeholder="Separate multiple items with commas" /></label>
              <label className="director-field director-field-wide">Permissions<input value={form.permissions} onChange={(event) => update("permissions", event.target.value)} placeholder="tasks, reports, attendance…" /></label>
              <label className="director-field director-field-wide">Notes<textarea rows={3} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Role notes and access context…" /></label>
            </div>
          </>
        )}

        {organization && (
          <>
            <div className="director-form-section-heading"><span>01</span><div><strong>Organization structure</strong><small>Keep departments and teams connected to delivery.</small></div></div>
            <div className="director-form-grid">
              <label className="director-field director-field-wide">{kind === "department" ? "Department" : "Team"} name *<input required value={form.name} onChange={(event) => update("name", event.target.value)} placeholder={kind === "department" ? "e.g. Growth" : "e.g. Design Pod A"} /></label>
              {kind === "team" && <label className="director-field">Department<select value={form.department} onChange={(event) => update("department", event.target.value)}>{departmentOptions.map((option) => <option key={option}>{option}</option>)}</select></label>}
              <label className="director-field">Manager<select value={form.manager} onChange={(event) => update("manager", event.target.value)}><option value="">Unassigned</option>{managers.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}</select></label>
              {kind === "team" && <label className="director-field">Team lead<select value={form.teamLead} onChange={(event) => update("teamLead", event.target.value)}><option value="">Unassigned</option>{teamLeads.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}</select></label>}
              <label className="director-field">Status<select value={form.status} onChange={(event) => update("status", event.target.value)}>{["Active", "Inactive", "Archived"].map((option) => <option key={option}>{option}</option>)}</select></label>
              <label className="director-field">Accent color<input type="color" value={form.color} onChange={(event) => update("color", event.target.value)} /></label>
              <label className="director-field director-field-wide">Description<textarea rows={4} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What does this area own?" /></label>
            </div>
          </>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <div className="director-form-actions">
          <Button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy}>
            {busy ? <Loader2 className="director-spin" size={16} /> : <CheckCircle2 size={16} />}
            {busy ? "Saving…" : row ? "Save changes" : "Add " + label}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TaskRow({
  task,
  project,
  assignee,
  onOpen,
  onEdit,
}: {
  task: Entity;
  project?: Entity;
  assignee?: Entity;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const today = localDateKey();
  const overdue = isOverdue(task, today);
  const dueKey = dateKey(task.due);

  return (
    <article className={"director-task-row " + (task.status === "Completed" ? "is-complete" : "")}>
      <button
        type="button"
        className="director-task-main"
        onClick={onOpen}
        aria-label={"Open task " + entityName(task)}
      >
        <span className={"director-priority priority-" + stringValue(task.priority || "Medium").toLowerCase()} aria-hidden="true" />
        <span className="director-task-copy">
          <strong>{entityName(task)}</strong>
          <small>{project ? entityName(project) : "Unlinked work"} · {stringValue(task.department || task.team_id || "Creative workspace")}</small>
          {tagsFor(task).length > 0 && (
            <span className="director-tag-line">
              {tagsFor(task).slice(0, 3).map((tag) => <i key={tag}>{tag}</i>)}
              {tagsFor(task).length > 3 && <i>+{tagsFor(task).length - 3}</i>}
            </span>
          )}
        </span>
      </button>
      <Badge value={stringValue(task.status || "To Do")} />
      <span className={"director-due " + (overdue ? "overdue" : "") + (dueKey === today ? " today" : "")}>
        <Clock3 size={14} />
        <span>{overdue ? "Overdue · " : ""}{dateLabel(task.due)}</span>
      </span>
      <span className="director-assignee">
        {assignee ? <Avatar name={entityName(assignee)} role={assignee.role} /> : <span className="director-unassigned">—</span>}
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label={"Edit " + entityName(task)}
        title="Edit task"
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <MoreHorizontal size={18} />
      </button>
    </article>
  );
}

function BoardCard({
  task,
  assignee,
  onOpen,
}: {
  task: Entity;
  assignee?: Entity;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? {
        transform: "translate3d(" + transform.x + "px, " + transform.y + "px, 0)",
        zIndex: isDragging ? 5 : undefined,
      }
    : undefined;
  const overdue = isOverdue(task);

  return (
    <article ref={setNodeRef} style={style} className={"director-board-card " + (isDragging ? "is-dragging" : "")}>
      <div className="director-board-card-top">
        <span className={"director-priority priority-" + stringValue(task.priority || "Medium").toLowerCase()} aria-hidden="true" />
        <span className="director-board-card-label">{stringValue(task.priority || "Medium")}</span>
        <button
          type="button"
          className="director-drag-handle"
          {...listeners}
          {...attributes}
          aria-label={"Drag " + entityName(task)}
          title="Drag to change status"
        >
          ⠿
        </button>
      </div>
      <button type="button" className="director-board-title" onClick={onOpen}>{entityName(task)}</button>
      <div className="director-board-meta">
        <Badge value={stringValue(task.status || "To Do")} />
        <span className={overdue ? "overdue" : ""}>{overdue ? "Overdue" : relativeDueLabel(task.due)}</span>
      </div>
      <div className="director-board-foot">
        <small>{stringValue(task.department || task.team_id || "Creative")}</small>
        {assignee ? <Avatar name={entityName(assignee)} role={assignee.role} /> : <span className="director-unassigned">—</span>}
      </div>
    </article>
  );
}

function BoardColumn({
  status,
  tasks,
  peopleById,
  onOpen,
}: {
  status: string;
  tasks: Entity[];
  peopleById: Map<string, Entity>;
  onOpen: (task: Entity) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section ref={setNodeRef} className={"director-board-column " + (isOver ? "is-over" : "")} aria-label={status + " tasks"}>
      <header>
        <span className={"director-status-dot status-" + slug(status)} />
        <strong>{status}</strong>
        <b>{tasks.length}</b>
      </header>
      <div className="director-board-column-body">
        {tasks.map((task) => (
          <BoardCard
            key={task.id}
            task={task}
            assignee={peopleById.get(stringValue(task.assignee))}
            onOpen={() => onOpen(task)}
          />
        ))}
        {!tasks.length && <span className="director-drop-hint">Drop work here</span>}
      </div>
    </section>
  );
}

function GoalCard({ goal }: { goal: Entity }) {
  const percent = Math.max(0, Math.min(100, numberValue(goal.progress)));

  return (
    <article className="director-goal-card">
      <div className="director-goal-icon"><Target size={17} /></div>
      <div className="director-goal-copy">
        <div>
          <strong>{entityName(goal)}</strong>
          <Badge value={stringValue(goal.status || "In progress")} />
        </div>
        <p>{stringValue(goal.description || "Keep the team aligned around a measurable outcome.")}</p>
        <div className="director-goal-progress"><i style={{ width: percent + "%" }} /></div>
        <small>{percent}% complete</small>
      </div>
    </article>
  );
}

function clientRelationProjects(client: Entity, projects: Entity[]): Entity[] {
  const clientId = stringValue(client.id);
  const source = client as Record<string, unknown>;
  const assignedIds = new Set(stringList(source.assigned_projects || source.project_ids || source.projects));
  return projects.filter((project) => {
    const linkedClient = relationId(project, "client_id", "clientId", "client");
    return (linkedClient && linkedClient === clientId) || assignedIds.has(stringValue(project.id));
  });
}

function clientNeedsAttention(client: Entity, projects: Entity[], tasks: Entity[]): boolean {
  if (["at risk", "overdue", "inactive", "archived"].includes(normalizedStatus(client.status))) return true;
  const relatedProjects = clientRelationProjects(client, projects);
  return tasks.some((task) => {
    const linkedClient = relationId(task, "client_id", "clientId", "client");
    return Boolean(linkedClient && linkedClient === stringValue(client.id) && isOverdue(task));
  }) || relatedProjects.some((project) => normalizedStatus(project.status) === "at risk");
}

function ClientCard({
  client,
  projects,
  tasks,
  people,
  onEdit,
  onArchive,
}: {
  client: Entity;
  projects: Entity[];
  tasks: Entity[];
  people: Entity[];
  onEdit: () => void;
  onArchive: () => void;
}) {
  const relatedProjects = clientRelationProjects(client, projects);
  const projectIds = new Set(relatedProjects.map((project) => stringValue(project.id)));
  const relatedTasks = tasks.filter((task) => {
    const linkedClient = relationId(task, "client_id", "clientId", "client");
    return linkedClient === stringValue(client.id) || projectIds.has(stringValue(task.project_id));
  });
  const openTasks = relatedTasks.filter((task) => task.status !== "Completed").length;
  const completion = relatedProjects.length
    ? Math.round(relatedProjects.reduce((sum, project) => sum + progressFor(stringValue(project.id), tasks), 0) / relatedProjects.length)
    : 0;
  const managerId = relationId(client, "manager_id", "manager", "assigned_manager_id");
  const teamLeadId = relationId(client, "team_lead_id", "team_lead", "assigned_team_lead_id");
  const manager = people.find((person) => stringValue(person.id) === managerId);
  const teamLead = people.find((person) => stringValue(person.id) === teamLeadId);
  const email = fieldValue(client, "email");
  const phone = fieldValue(client, "phone", "mobile");
  const attention = clientNeedsAttention(client, projects, tasks);

  return (
    <article className={"director-client-card " + (attention ? "is-attention" : "")}>
      <div className="director-client-card-head">
        <Avatar name={entityName(client)} />
        <span>
          <strong>{entityName(client)}</strong>
          <small>{fieldValue(client, "company", "company_name") || "Independent client"}</small>
        </span>
        <Badge value={attention ? "Needs attention" : stringValue(client.status || "Active")} />
      </div>
      <div className="director-client-contact">
        {email ? <a href={"mailto:" + email}><Mail size={14} />{email}</a> : <span><Mail size={14} />No email added</span>}
        {phone ? <span><MessageCircle size={14} />{phone}</span> : <span><MessageCircle size={14} />No phone added</span>}
      </div>
      <div className="director-client-stats">
        <span><b>{relatedProjects.length}</b><small>Projects</small></span>
        <span><b>{openTasks}</b><small>Open tasks</small></span>
        <span><b>{completion}%</b><small>Delivery</small></span>
      </div>
      <div className="director-client-progress"><i style={{ width: completion + "%" }} /></div>
      <div className="director-client-relationships">
        <span><small>Manager</small><strong>{manager ? entityName(manager) : "Unassigned"}</strong></span>
        <span><small>Team lead</small><strong>{teamLead ? entityName(teamLead) : "Unassigned"}</strong></span>
        <span><small>Last activity</small><strong>{dateLabel(fieldValue(client, "last_activity", "updated_at", "created_at"))}</strong></span>
      </div>
      <div className="director-client-actions">
        {email ? <a className="btn secondary" href={"mailto:" + email}><MessageCircle size={14} /> Contact</a> : <span className="director-action-muted">Contact unavailable</span>}
        <button type="button" className="btn secondary" onClick={onEdit}><SlidersHorizontal size={14} /> Edit</button>
        <button type="button" className="icon-btn danger" onClick={onArchive} aria-label={"Archive " + entityName(client)} title="Archive client"><Archive size={16} /></button>
      </div>
    </article>
  );
}

function ClientSummarySection({
  clients,
  projects,
  tasks,
  people,
  onAdd,
  onEdit,
  onArchive,
}: {
  clients: Entity[];
  projects: Entity[];
  tasks: Entity[];
  people: Entity[];
  onAdd: () => void;
  onEdit: (client: Entity) => void;
  onArchive: (client: Entity) => void;
}) {
  const now = new Date();
  const activeClients = clients.filter(isActiveEntity);
  const newThisMonth = clients.filter((client) => {
    const date = dateFromValue(fieldValue(client, "created_at", "createdAt"));
    return Boolean(date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth());
  });
  const attention = clients.filter((client) => clientNeedsAttention(client, projects, tasks));
  const summaries = [
    { label: "Total Clients", value: clients.length, note: "Live client records", tone: "blue", icon: BriefcaseBusiness },
    { label: "Active Clients", value: activeClients.length, note: "Currently in delivery", tone: "green", icon: CheckCircle2 },
    { label: "New This Month", value: newThisMonth.length, note: "Created this month", tone: "violet", icon: TrendingUp },
    { label: "Needs Attention", value: attention.length, note: "Risk, overdue or inactive", tone: "red", icon: AlertTriangle },
  ];

  return (
    <section className="director-card director-client-summary-shell">
      <div className="director-card-heading">
        <div>
          <span className="eyebrow"><BriefcaseBusiness size={14} /> CLIENT SUMMARY</span>
          <h2>Relationships that need momentum</h2>
        </div>
        <div className="director-heading-actions"><button type="button" className="btn" onClick={onAdd}><Plus size={15} /> Add client</button><Link to="/clients">View all <ArrowRight size={15} /></Link></div>
      </div>
      <div className="director-client-summary-grid">
        {summaries.map(({ label, value, note, tone, icon: Icon }) => (
          <article className={"director-summary-stat director-summary-stat-" + tone} key={label}>
            <span><Icon size={16} /></span><small>{label}</small><strong>{value}</strong><em>{note}</em>
          </article>
        ))}
      </div>
      {clients.length ? (
        <div className="director-client-grid">
          {clients.slice().sort((a, b) => Number(clientNeedsAttention(b, projects, tasks)) - Number(clientNeedsAttention(a, projects, tasks))).slice(0, 6).map((client) => (
            <ClientCard key={client.id} client={client} projects={projects} tasks={tasks} people={people} onEdit={() => onEdit(client)} onArchive={() => onArchive(client)} />
          ))}
        </div>
      ) : (
        <Empty title="No clients yet" description="Add the first client to start tracking relationships and delivery." />
      )}
    </section>
  );
}

function PeopleSummarySection({
  people,
  onAdd,
  onEdit,
}: {
  people: Entity[];
  onAdd: (kind: ComposerKind) => void;
  onEdit: (person: Entity) => void;
}) {
  const activePeople = people.filter(isActiveEntity);
  const roleGroups = [
    { label: "Directors", value: people.filter((person) => normalizedStatus(person.role) === "director").length },
    { label: "Managers", value: people.filter((person) => normalizedStatus(person.role) === "manager").length },
    { label: "Team Leads", value: people.filter((person) => ["team lead", "team leader", "team_lead"].includes(normalizedStatus(person.role))).length },
    { label: "Employees", value: people.filter((person) => normalizedStatus(person.role) === "employee").length },
    { label: "Inactive", value: people.filter((person) => !isActiveEntity(person)).length },
  ];

  return (
    <section className="director-card director-people-summary-shell">
      <div className="director-card-heading">
        <div><span className="eyebrow"><Users size={14} /> PEOPLE AND ROLES</span><h2>Keep the hierarchy clear</h2></div>
        <div className="director-heading-actions"><button type="button" className="btn" onClick={() => onAdd("employee")}><UserPlus size={15} /> Add person</button><Link to="/people">Open people <ArrowRight size={15} /></Link></div>
      </div>
      <div className="director-role-stat-row">{roleGroups.map((group) => <button type="button" key={group.label} onClick={() => onAdd(group.label === "Managers" ? "manager" : group.label === "Team Leads" ? "team_lead" : "employee")}><strong>{group.value}</strong><span>{group.label}</span></button>)}</div>
      {activePeople.length ? (
        <div className="director-people-preview">
          {activePeople.slice(0, 6).map((person) => (
            <button type="button" className="director-person-preview" key={person.id} onClick={() => onEdit(person)}>
              <Avatar name={entityName(person)} role={person.role} />
              <span><strong>{entityName(person)}</strong><small>{roleLabel(person.role)} · {fieldValue(person, "department", "department_id") || "No department"}</small></span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <Empty title="No active people yet" description="Add a manager, team lead or employee to see team capacity here." />
      )}
    </section>
  );
}

function barWidth(value: number, maximum: number): string {
  return Math.max(0, Math.min(100, maximum ? Math.round((value / maximum) * 100) : 0)) + "%";
}

function DirectorAnalytics({
  tasks,
  projects,
  people,
  clients,
  attendance,
  invoices,
}: {
  tasks: Entity[];
  projects: Entity[];
  people: Entity[];
  clients: Entity[];
  attendance: Entity[];
  invoices: Entity[];
}) {
  const statusesForChart = Array.from(new Set([...statuses, ...tasks.map((task) => stringValue(task.status))].filter(Boolean)));
  const priorities = ["Urgent", "High", "Medium", "Low"];
  const monthlyRevenue = invoices.reduce((sum, invoice) => sum + (isApproved(invoice) ? numberValue(invoice.amount) : 0), 0);
  const attendancePresent = attendance.filter((row) => ["present", "on time", "approved"].includes(normalizedStatus(row.status))).length;
  const attendanceRate = attendance.length ? Math.round((attendancePresent / attendance.length) * 100) : 0;
  const activeProjects = projects.filter((project) => isActiveEntity(project) && normalizedStatus(project.status) !== "completed");

  return (
    <section className="director-card director-analytics-shell">
      <div className="director-card-heading"><div><span className="eyebrow"><BarChart3 size={14} /> LIVE ANALYTICS</span><h2>Delivery signals from real records</h2></div><Link to="/reports">Open reports <ArrowRight size={15} /></Link></div>
      <div className="director-analytics-grid">
        <article className="director-analytics-panel">
          <div className="director-analytics-panel-head"><span><ClipboardCheck size={16} /> Tasks by status</span><strong>{tasks.length}</strong></div>
          <div className="director-analytics-bars">{statusesForChart.map((status) => { const count = tasks.filter((task) => stringValue(task.status) === status).length; return <div className="director-analytics-bar-row" key={status}><span>{status}</span><i><b style={{ width: barWidth(count, tasks.length) }} /></i><strong>{count}</strong></div>; })}</div>
        </article>
        <article className="director-analytics-panel">
          <div className="director-analytics-panel-head"><span><Target size={16} /> Priority mix</span><strong>{tasks.filter((task) => task.status !== "Completed").length} open</strong></div>
          <div className="director-analytics-bars">{priorities.map((priority) => { const count = tasks.filter((task) => stringValue(task.priority) === priority).length; return <div className="director-analytics-bar-row" key={priority}><span>{priority}</span><i><b className={"priority-bar priority-bar-" + priority.toLowerCase()} style={{ width: barWidth(count, tasks.length) }} /></i><strong>{count}</strong></div>; })}</div>
        </article>
        <article className="director-analytics-panel director-analytics-highlight">
          <div className="director-analytics-panel-head"><span><Gauge size={16} /> Organization pulse</span><strong>{attendance.length ? attendanceRate + "%" : "—"}</strong></div>
          <div className="director-pulse-facts"><span><b>{activeProjects.length}</b><small>active projects</small></span><span><b>{people.filter(isActiveEntity).length}</b><small>active people</small></span><span><b>{clients.filter(isActiveEntity).length}</b><small>active clients</small></span></div>
          <div className="director-analytics-note"><span>{attendance.length ? "Attendance overview" : "Attendance data not connected yet"}</span><strong>{attendance.length ? attendancePresent + " of " + attendance.length + " records present" : "Add attendance records to see the rate"}</strong></div>
          {invoices.length > 0 && <div className="director-analytics-note"><span>Approved finance</span><strong>{currency(monthlyRevenue)}</strong></div>}
        </article>
      </div>
    </section>
  );
}

function DirectorQuickActions({ onAction }: { onAction: (kind: ComposerKind) => void }) {
  const actions: Array<{ kind: ComposerKind; label: string; description: string; icon: LucideIcon }> = [
    { kind: "client", label: "Add Client", description: "Start a new relationship", icon: BriefcaseBusiness },
    { kind: "employee", label: "Add Employee", description: "Create an employee record", icon: UserRound },
    { kind: "manager", label: "Add Manager", description: "Set a reporting owner", icon: Users },
    { kind: "team_lead", label: "Add Team Lead", description: "Assign team leadership", icon: UserPlus },
    { kind: "department", label: "Create Department", description: "Add an organization space", icon: Building2 },
    { kind: "team", label: "Create Team", description: "Group people for delivery", icon: Users },
    { kind: "project", label: "Create Project", description: "Plan a delivery outcome", icon: FolderKanban },
    { kind: "task", label: "Create Task", description: "Turn work into an action", icon: CheckCircle2 },
  ];

  return (
    <section className="director-card director-quick-actions-shell">
      <div className="director-card-heading"><div><span className="eyebrow"><Sparkles size={14} /> QUICK ACTIONS</span><h2>Move the workspace forward</h2></div><span className="director-card-kicker">Every action saves to the live workspace</span></div>
      <div className="director-quick-actions-grid">{actions.map(({ kind, label, description, icon: Icon }) => <button type="button" key={kind} onClick={() => onAction(kind)}><span className="director-quick-action-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={15} /></button>)}</div>
    </section>
  );
}

function QuickAddMenu({ onAction }: { onAction: (kind: ComposerKind) => void }) {
  const [open, setOpen] = useState(false);
  const actions: Array<{ kind: ComposerKind; label: string; icon: LucideIcon }> = [
    { kind: "client", label: "Add Client", icon: BriefcaseBusiness },
    { kind: "employee", label: "Add Employee", icon: UserRound },
    { kind: "manager", label: "Add Manager", icon: Users },
    { kind: "team_lead", label: "Add Team Lead", icon: UserPlus },
    { kind: "department", label: "Create Department", icon: Building2 },
    { kind: "team", label: "Create Team", icon: Users },
    { kind: "project", label: "Create Project", icon: FolderKanban },
    { kind: "task", label: "Create Task", icon: CheckCircle2 },
  ];

  return (
    <div className="director-quick-add">
      <button type="button" className="btn" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-haspopup="menu"><Plus size={16} /> Quick Add <ChevronRight className={open ? "director-chevron-open" : ""} size={14} /></button>
      {open && <div className="director-quick-add-menu" role="menu">{actions.map(({ kind, label, icon: Icon }) => <button type="button" role="menuitem" key={kind} onClick={() => { setOpen(false); onAction(kind); }}><Icon size={16} />{label}</button>)}</div>}
    </div>
  );
}

function DirectorPulse({
  openTasks,
  soon,
  overdue,
  review,
  completion,
  capacity,
  onView,
}: {
  openTasks: number;
  soon: number;
  overdue: number;
  review: number;
  completion: number;
  capacity: number;
  onView: (view: DirectorView) => void;
}) {
  const items = [
    { label: "Open work", value: openTasks, note: "active tasks", view: "list" as DirectorView, tone: "blue" },
    { label: "Due soon", value: soon, note: "next 7 days", view: "calendar" as DirectorView, tone: "amber" },
    { label: "Needs attention", value: overdue, note: "overdue items", view: "list" as DirectorView, tone: "red" },
    { label: "In review", value: review, note: "awaiting decision", view: "board" as DirectorView, tone: "violet" },
    { label: "Delivery", value: completion + "%", note: "completed here", view: "overview" as DirectorView, tone: "green" },
  ];

  return (
    <section className="director-card director-pulse-card" aria-label="Operating pulse">
      <div className="director-card-heading">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> OPERATING PULSE</span>
          <h2>See the next decision at a glance</h2>
        </div>
        <span className="director-pulse-capacity"><Users size={14} /> {capacity}% planned capacity</span>
      </div>
      <div className="director-kpi-grid director-pulse-grid">
        {items.map((item) => (
          <button
            type="button"
            className={"director-kpi director-pulse-item director-pulse-" + item.tone}
            key={item.label}
            onClick={() => onView(item.view)}
          >
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.note}</small>
            <ChevronRight size={14} />
          </button>
        ))}
      </div>
    </section>
  );
}

function DirectorOverview({
  tasks,
  projects,
  teamLoads,
  goals,
  activity,
  onOpenTask,
}: {
  tasks: Entity[];
  projects: Entity[];
  teamLoads: TeamLoad[];
  goals: Entity[];
  activity: Entity[];
  onOpenTask: (task: Entity) => void;
}) {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const focusTasks = tasks
    .filter((task) => task.status !== "Completed")
    .slice()
    .sort(compareTasks)
    .slice(0, 6);
  const healthProjects = projects
    .slice()
    .sort((a, b) => Number(b.status === "At Risk") - Number(a.status === "At Risk") || progressFor(a.id, tasks) - progressFor(b.id, tasks))
    .slice(0, 6);

  return (
    <>
      <div className="director-overview-grid">
        <article className="director-card director-focus-card">
          <div className="director-card-heading">
            <div>
              <span className="eyebrow"><Command size={14} /> FOCUS QUEUE</span>
              <h2>Work that needs a decision</h2>
            </div>
            <Link to="/tasks">Open tasks <ArrowRight size={15} /></Link>
          </div>
          {focusTasks.length ? (
            <div className="director-focus-list">
              {focusTasks.map((task) => (
                <button type="button" className="director-focus-row" key={task.id} onClick={() => onOpenTask(task)}>
                  <span className={"director-priority priority-" + stringValue(task.priority || "Medium").toLowerCase()} />
                  <span>
                    <strong>{entityName(task)}</strong>
                    <small>{projectMap.get(stringValue(task.project_id)) ? entityName(projectMap.get(stringValue(task.project_id))) : "Unlinked work"} · {relativeDueLabel(task.due)}</small>
                  </span>
                  <Badge value={stringValue(task.status || "To Do")} />
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <Empty title="The queue is clear" description="No open work needs your attention in this space." />
          )}
        </article>

        <article className="director-card director-health-card">
          <div className="director-card-heading">
            <div>
              <span className="eyebrow"><Gauge size={14} /> PORTFOLIO HEALTH</span>
              <h2>Projects in motion</h2>
            </div>
            <Link to="/projects">View all <ArrowRight size={15} /></Link>
          </div>
          {healthProjects.length ? (
            <div className="director-project-health-list">
              {healthProjects.map((project) => {
                const progress = progressFor(project.id, tasks);
                const projectRisk =
                  project.status === "At Risk" ||
                  tasks.some((task) => task.project_id === project.id && isOverdue(task));
                return (
                  <Link className="director-project-health" to="/projects" key={project.id}>
                    <span className="director-project-health-icon"><FolderKanban size={16} /></span>
                    <span>
                      <strong>{entityName(project)}</strong>
                      <small>{stringValue(project.department || "Agency")} · {progress}% delivered</small>
                      <span className="director-mini-progress"><i style={{ width: progress + "%" }} /></span>
                    </span>
                    <Badge value={projectRisk ? "At Risk" : stringValue(project.status || "Active")} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <Empty title="No projects yet" description="Create a project to see portfolio health here." />
          )}
        </article>
      </div>

      <div className="director-overview-lower">
        <article className="director-card">
          <div className="director-card-heading">
            <div>
              <span className="eyebrow"><Users size={14} /> TEAM CAPACITY</span>
              <h2>Where the energy is going</h2>
            </div>
            <Link to="/workload">Open workload <ArrowRight size={15} /></Link>
          </div>
          {teamLoads.length ? (
            <div className="director-capacity-list">
              {teamLoads.slice(0, 6).map(({ person, hours, open, percent }) => (
                <Link to="/workload" className="director-capacity-row" key={person.id}>
                  <Avatar name={entityName(person)} role={person.role} />
                  <span>
                    <strong>{entityName(person)}</strong>
                    <small>{stringValue(person.department || person.team_id || "Team")} · {open} open tasks</small>
                  </span>
                  <span className="director-capacity-meter"><i className={percent > 100 ? "risk" : ""} style={{ width: Math.min(percent, 100) + "%" }} /></span>
                  <b>{hours}h</b>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="No people yet" description="Add team members to see capacity here." />
          )}
        </article>

        <article className="director-card">
          <div className="director-card-heading">
            <div>
              <span className="eyebrow"><Target size={14} /> GOALS</span>
              <h2>Company-level momentum</h2>
            </div>
            <Link to="/reports">Reports <ArrowRight size={15} /></Link>
          </div>
          {goals.length ? (
            <div className="director-goal-list">{goals.slice(0, 3).map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div>
          ) : (
            <Empty title="No goals yet" description="Add a measurable outcome to keep the team aligned." />
          )}
        </article>
      </div>

      <article className="director-card director-activity-card">
        <div className="director-card-heading">
          <div>
            <span className="eyebrow"><Activity size={14} /> RECENT ACTIVITY</span>
            <h2>Everything important, in one feed</h2>
          </div>
          <Link to="/activity_logs">Audit log <ArrowRight size={15} /></Link>
        </div>
        {activity.length ? (
          <div className="director-activity-list">
            {activity.slice(0, 7).map((item) => (
              <div className="director-activity-row" key={item.id}>
                <span className="director-activity-dot"><CircleDot size={15} /></span>
                <span>
                  <strong>{entityName(item)}</strong>
                  <small>{item.description ? stringValue(item.description).slice(0, 100) : "Workspace activity recorded"}</small>
                </span>
                <time>{dateLabel(item.created_at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Your activity feed is ready" description="Create or update work to see the workspace rhythm here." />
        )}
      </article>
    </>
  );
}

export default function DirectorDashboard() {
  const { user, data, save, loading } = useWorkspace();
  const [activeSpace, setActiveSpace] = useState("everything");
  const [view, setView] = useState<DirectorView>("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All");
  const [composer, setComposer] = useState<{ kind: ComposerKind; row?: Entity } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Entity | null>(null);
  const [actionError, setActionError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [archiveClient, setArchiveClient] = useState<Entity | null>(null);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const projects = rowsFrom(data, "projects");
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const spaces = useMemo(() => {
    const storedSpaces = rowsFrom(data, "spaces");
    const storedDepartments = rowsFrom(data, "departments");
    const combined = [...storedSpaces, ...storedDepartments];
    if (!combined.length) return DEFAULT_SPACES;
    return Array.from(new Map(combined.map((space) => [stringValue(space.id) || slug(entityName(space)), space])).values());
  }, [data]);
  const tasks = useMemo(() => scoped(rowsFrom(data, "tasks"), user), [data, user]);
  const employees = rowsFrom(data, "employees");
  const clients = rowsFrom(data, "clients");
  const approvals = rowsFrom(data, "approvals");
  const attendance = rowsFrom(data, "attendance");
  const invoices = rowsFrom(data, "invoices").concat(rowsFrom(data, "finance"));
  const peopleById = useMemo(() => new Map(employees.map((person) => [person.id, person])), [employees]);
  const today = localDateKey();
  const selectedSpace = spaces.find((space) => space.id === activeSpace);

  const spaceTasks = useMemo(
    () => tasks.filter((task) => activeSpace === "everything" || resolveSpaceId(task, projectMap) === activeSpace),
    [tasks, activeSpace, projectMap],
  );

  const visibleProjects = useMemo(
    () => projects.filter((project) => activeSpace === "everything" || resolveSpaceId(project, projectMap) === activeSpace),
    [projects, activeSpace, projectMap],
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return spaceTasks
      .filter((task) => {
        const project = projectMap.get(stringValue(task.project_id));
        const assignee = peopleById.get(stringValue(task.assignee));
        const haystack = [
          entityName(task),
          task.description,
          task.department,
          task.priority,
          project && entityName(project),
          assignee && entityName(assignee),
          ...tagsFor(task),
        ].filter(Boolean).join(" ").toLowerCase();

        return (
          (!query || haystack.includes(query)) &&
          (statusFilter === "All" || task.status === statusFilter) &&
          (priorityFilter === "All" || task.priority === priorityFilter) &&
          (assigneeFilter === "All" || stringValue(task.assignee) === assigneeFilter)
        );
      })
      .sort(compareTasks);
  }, [spaceTasks, search, statusFilter, priorityFilter, assigneeFilter, projectMap, peopleById]);

  const completed = spaceTasks.filter((task) => task.status === "Completed").length;
  const openTasks = spaceTasks.filter((task) => task.status !== "Completed");
  const overdue = openTasks.filter((task) => isOverdue(task, today));
  const review = spaceTasks.filter((task) => task.status === "Internal Review" || task.status === "Revision");
  const completion = Math.round((completed / Math.max(spaceTasks.length, 1)) * 100);
  const activeProjects = visibleProjects.filter((project) => isActiveEntity(project) && normalizedStatus(project.status) !== "completed");
  const activePeople = employees.filter(isActiveEntity);
  const pendingApprovals = approvals.filter((approval) => !isApproved(approval));
  const sevenDaysFromToday = addDaysKey(today, 7);
  const soon = openTasks.filter((task) => {
    const due = dateKey(task.due);
    return Boolean(due) && due >= today && due <= sevenDaysFromToday;
  }).length;
  const totalOpenHours = openTasks.reduce((sum, task) => sum + numberValue(task.hours), 0);
  const capacity = employees.length ? Math.round((totalOpenHours / (employees.length * 40)) * 100) : 0;

  const metrics: Metric[] = [
    { label: "Total Clients", value: clients.length, note: activeClientsNote(clients), icon: BriefcaseBusiness, tone: "blue", href: "/clients" },
    { label: "Active Projects", value: activeProjects.length, note: visibleProjects.length + " total projects", icon: FolderKanban, tone: "green", href: "/projects" },
    { label: "Total Team Members", value: activePeople.length, note: employees.length - activePeople.length + " inactive", icon: Users, tone: "violet", href: "/people" },
    { label: "Pending Approvals", value: pendingApprovals.length, note: pendingApprovals.length ? "Requires review" : "All caught up", icon: ClipboardCheck, tone: "amber", href: "/approvals" },
    { label: "Overdue Tasks", value: overdue.length, note: overdue.length ? "Needs a decision today" : "No overdue work", icon: AlertTriangle, tone: "red", href: "/tasks" },
    { label: "Overall Completion Rate", value: completion + "%", note: completed + " of " + spaceTasks.length + " tasks complete", icon: TrendingUp, tone: "cyan", href: "/reports" },
  ];

  const teamLoads = useMemo<TeamLoad[]>(
    () => employees
      .map((person) => {
        const assigned = spaceTasks.filter((task) => stringValue(task.assignee) === stringValue(person.id) && task.status !== "Completed");
        const hours = assigned.reduce((sum, task) => sum + numberValue(task.hours), 0);
        return { person, hours, open: assigned.length, percent: Math.round((hours / 40) * 100) };
      })
      .sort((a, b) => b.percent - a.percent || b.open - a.open),
    [employees, spaceTasks],
  );

  const goals: Entity[] = (data.goals || []).length
    ? data.goals || []
    : visibleProjects.slice(0, 3).map((project) => ({
        id: "goal-" + project.id,
        name: entityName(project),
        status: project.status,
        progress: progressFor(project.id, spaceTasks),
        description: project.description,
      }));

  const activity = (data.activity_logs || [])
    .slice()
    .sort((a, b) => stringValue(b.created_at).localeCompare(stringValue(a.created_at)));

  const calendarDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarOffset = (calendarMonth.getDay() + 6) % 7;
  const calendarCells: Array<string | null> = Array.from({ length: calendarOffset + calendarDays }, (_, index) => {
    if (index < calendarOffset) return null;
    const day = index - calendarOffset + 1;
    return calendarMonth.getFullYear() + "-" +
      String(calendarMonth.getMonth() + 1).padStart(2, "0") + "-" +
      String(day).padStart(2, "0");
  });
  const calendarTaskMap = useMemo(() => {
    const map = new Map<string, Entity[]>();
    filteredTasks.forEach((task) => {
      const due = dateKey(task.due);
      if (!due) return;
      const current = map.get(due) || [];
      current.push(task);
      map.set(due, current);
    });
    return map;
  }, [filteredTasks]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setPriorityFilter("All");
    setAssigneeFilter("All");
  };

  async function handleDragEnd(event: DragEndEvent) {
    const nextStatus = event.over ? stringValue(event.over.id) : "";
    const task = tasks.find((item) => item.id === stringValue(event.active.id));
    if (!task || !statuses.includes(nextStatus) || task.status === nextStatus) return;

    try {
      await save("tasks", { ...task, status: nextStatus });
      setActionError("");
      setToast({ tone: "success", message: "Task status updated successfully." });
    } catch (cause) {
      const message = errorMessage(cause);
      setActionError(message);
      setToast({ tone: "error", message });
    }
  }

  const viewTitle = view === "overview" ? "Director overview" : view.charAt(0).toUpperCase() + view.slice(1) + " view";
  const hasFilters = Boolean(search || statusFilter !== "All" || priorityFilter !== "All" || assigneeFilter !== "All");
  const firstName = stringValue(user?.name || "Director").trim().split(/\s+/)[0] || "Director";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openComposer = (kind: ComposerKind, row?: Entity) => {
    setComposer({ kind, row });
    setMobileRailOpen(false);
  };

  const notifySuccess = (message: string) => {
    setActionError("");
    setToast({ tone: "success", message });
  };

  const notifyFailure = (message: string) => {
    setActionError(message);
    setToast({ tone: "error", message });
  };

  async function archiveSelectedClient() {
    if (!archiveClient) return;
    const target = archiveClient;
    try {
      await save("clients", {
        ...target,
        status: "Archived",
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      });
      try {
        await save("activity_logs", {
          name: "Client archived",
          description: "Archived " + entityName(target) + " from Creative Adhyayan.",
          actor_id: user?.id,
          created_by: user?.id,
          entity_type: "clients",
          entity_id: target.id,
          created_at: new Date().toISOString(),
        });
      } catch {
        // The client archive is the primary operation.
      }
      setArchiveClient(null);
      notifySuccess("Client archived successfully.");
    } catch (cause) {
      notifyFailure(errorMessage(cause));
    }
  }

  if (!user) return null;
  if (loading) return <DirectorLoadingState />;

  return (
    <div className="director-page">
      <header className="director-header">
        <div className="director-header-copy">
          <span className="eyebrow"><Command size={14} /> DIRECTOR COMMAND CENTER</span>
          <div className="director-title-line">
            <h1>{greeting}, {firstName}.</h1>
            <span className="director-live-pill"><i /> Live workspace</span>
          </div>
          <p>One focused view for people, projects, tasks and the decisions shaping Creative Adhyayan.</p>
          <div className="director-header-meta">
            <span><CalendarDays size={14} /> {fullDateLabel(today)}</span>
            <span><Users size={14} /> {employees.length} people · {projects.length} projects</span>
          </div>
        </div>
        <div className="director-header-actions">
          <QuickAddMenu onAction={openComposer} />
          <Link className="icon-btn director-header-icon" to="/notifications" aria-label="Notifications" title="Notifications"><Bell size={17} /></Link>
          <Link className="icon-btn director-header-icon" to="/activity_logs" aria-label="Activity and audit logs" title="Activity and audit logs"><HelpCircle size={17} /></Link>
          <Button className="secondary" onClick={() => setComposer({ kind: "project" })}>
            <FolderKanban size={16} /> New project
          </Button>
          <Button onClick={() => setComposer({ kind: "task" })}>
            <Plus size={17} /> New task
          </Button>
          <button type="button" className="icon-btn director-mobile-menu-button" onClick={() => setMobileRailOpen((current) => !current)} aria-label={mobileRailOpen ? "Close workspace navigation" : "Open workspace navigation"} aria-expanded={mobileRailOpen}>
            {mobileRailOpen ? <X size={19} /> : <SlidersHorizontal size={19} />}
          </button>
        </div>
      </header>

      <div className="director-layout">
        <aside className={"director-space-rail " + (mobileRailOpen ? "is-open" : "")} aria-label="Workspace spaces">
          <div className="director-rail-heading">
            <span>WORKSPACE</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Create a project"
              title="Create a project"
              onClick={() => setComposer({ kind: "project" })}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="director-space-list">
            <button
              type="button"
              className={"director-space-item " + (activeSpace === "everything" ? "active" : "")}
              onClick={() => {
                setActiveSpace("everything");
                setView("overview");
              }}
              aria-current={activeSpace === "everything" ? "page" : undefined}
            >
              <span className="director-space-icon everything"><LayersIcon /></span>
              <span><strong>Everything</strong><small>{tasks.length} tasks · {projects.length} projects</small></span>
            </button>

            {spaces.map((space) => {
              const count = tasks.filter((task) => resolveSpaceId(task, projectMap) === space.id).length;
              const color = initialsColor(space);
              return (
                <button
                  type="button"
                  className={"director-space-item " + (activeSpace === space.id ? "active" : "")}
                  key={space.id}
                  onClick={() => {
                    setActiveSpace(space.id);
                    setView("list");
                  }}
                  aria-current={activeSpace === space.id ? "page" : undefined}
                >
                  <span className="director-space-icon" style={{ background: color + "18", color }}>
                    <CircleDot size={17} />
                  </span>
                  <span><strong>{entityName(space)}</strong><small>{count} tasks · {stringValue(space.status || "Active")}</small></span>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>

          <div className="director-rail-divider" />
          <span className="director-rail-label">WORKSPACE TOOLS</span>
          <nav className="director-tool-links" aria-label="Workspace tools">
            <Link to="/projects"><FolderKanban size={16} /> Projects <ChevronRight size={14} /></Link>
            <Link to="/people"><Users size={16} /> People & roles <ChevronRight size={14} /></Link>
            <Link to="/clients"><BriefcaseBusiness size={16} /> Clients <ChevronRight size={14} /></Link>
            <Link to="/tasks"><CheckCircle2 size={16} /> Tasks <ChevronRight size={14} /></Link>
            <Link to="/teams"><Building2 size={16} /> Departments & teams <ChevronRight size={14} /></Link>
            <Link to="/attendance"><Clock3 size={16} /> Attendance <ChevronRight size={14} /></Link>
            <Link to="/approvals"><ClipboardCheck size={16} /> Approvals <ChevronRight size={14} /></Link>
            <Link to="/reports"><BarChart3 size={16} /> Reports <ChevronRight size={14} /></Link>
            <Link to="/finance"><Wallet size={16} /> Finance <ChevronRight size={14} /></Link>
            <Link to="/files"><FileText size={16} /> Files <ChevronRight size={14} /></Link>
            <Link to="/notifications"><Bell size={16} /> Notifications <ChevronRight size={14} /></Link>
            <Link to="/activity_logs"><Activity size={16} /> Activity & audit <ChevronRight size={14} /></Link>
            <Link to="/settings"><SlidersHorizontal size={16} /> Settings <ChevronRight size={14} /></Link>
          </nav>

          <span className="director-rail-label director-rail-label-spaced">LIVE VIEWS</span>
          <div className="director-tool-view-links" aria-label="Live workspace views">
            {viewOptions.filter((option) => option.id !== "overview").map((option) => {
              const Icon = option.icon;
              return <button type="button" key={option.id} className={view === option.id ? "active" : ""} onClick={() => { setView(option.id); setMobileRailOpen(false); }}><Icon size={16} /> {option.label} <ChevronRight size={14} /></button>;
            })}
          </div>

          <div className={"director-rail-note " + (overdue.length ? "has-risk" : "")}>
            <Timer size={17} />
            <span>
              <strong>{overdue.length ? "Attention needed" : "Stay ahead"}</strong>
              <small>{overdue.length ? overdue.length + " overdue task" + (overdue.length === 1 ? "" : "s") + " in this space" : "No overdue work in this space"}</small>
            </span>
          </div>
        </aside>

        <section className="director-main-column">
          <section className="director-kpi-grid" aria-label="Director workspace metrics">
            {metrics.map(({ label, value, note, icon: Icon, tone, href }) => (
              <Link className={"director-kpi director-kpi-" + tone} key={label} to={href}>
                <span className="director-kpi-icon"><Icon size={18} /></span>
                <span className="director-kpi-label">{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
                <ArrowRight className="director-kpi-arrow" size={15} />
              </Link>
            ))}
          </section>

          <DirectorPulse
            openTasks={openTasks.length}
            soon={soon}
            overdue={overdue.length}
            review={review.length}
            completion={completion}
            capacity={capacity}
            onView={setView}
          />

          <section className="director-control-card">
            <div className="director-filter-row">
              <div className="director-search">
                <Search size={17} />
                <input
                  aria-label="Search director workspace"
                  placeholder="Search tasks, projects, people or tags…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <select aria-label="Filter task status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option>All</option>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <select aria-label="Filter task priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option>All</option>
                {["Urgent", "High", "Medium", "Low"].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <select aria-label="Filter task assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                <option value="All">Everyone</option>
                {employees.map((person) => <option value={person.id} key={person.id}>{entityName(person)}</option>)}
              </select>
              {hasFilters && <button type="button" className="director-clear-filter" onClick={clearFilters}>Clear filters</button>}
              <Button className="secondary director-export" onClick={() => exportCSV(filteredTasks, "creative-adhyayan-director-tasks")}>
                <BarChart3 size={15} /> Export
              </Button>
            </div>

            {hasFilters && (
              <div className="director-active-filter-summary" aria-live="polite">
                <span>{filteredTasks.length} matching task{filteredTasks.length === 1 ? "" : "s"}</span>
                <button type="button" onClick={clearFilters}>Reset filters</button>
              </div>
            )}

            <div className="director-view-row">
              <div>
                <span className="director-view-label">{activeSpace === "everything" ? "Everything" : entityName(selectedSpace)}</span>
                <span className="director-result-count">{filteredTasks.length} tasks · {visibleProjects.length} projects</span>
              </div>
              <div className="director-view-tabs" role="tablist" aria-label="Workspace views">
                {viewOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={view === option.id ? "active" : ""}
                      onClick={() => setView(option.id)}
                      role="tab"
                      aria-selected={view === option.id}
                      aria-label={option.label + " view"}
                    >
                      <Icon size={15} /> <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {actionError && (
            <div className="director-action-error" role="alert">
              <AlertTriangle size={16} /> <span>{actionError}</span>
              <button type="button" onClick={() => setActionError("")} aria-label="Dismiss error">Dismiss</button>
            </div>
          )}

          {view === "overview" && (
            <>
              <ClientSummarySection
                clients={clients}
                projects={visibleProjects}
                tasks={spaceTasks}
                people={employees}
                onAdd={() => openComposer("client")}
                onEdit={(client) => openComposer("client", client)}
                onArchive={(client) => setArchiveClient(client)}
              />
              <PeopleSummarySection
                people={employees}
                onAdd={openComposer}
                onEdit={(person) => openComposer(normalizedStatus(person.role) === "manager" ? "manager" : normalizedStatus(person.role) === "team lead" ? "team_lead" : "employee", person)}
              />
              <DirectorOverview
                tasks={spaceTasks}
                projects={visibleProjects}
                teamLoads={teamLoads}
                goals={goals}
                activity={activity}
                onOpenTask={setSelectedTask}
              />
              <DirectorAnalytics tasks={spaceTasks} projects={visibleProjects} people={employees} clients={clients} attendance={attendance} invoices={invoices} />
              <DirectorQuickActions onAction={openComposer} />
            </>
          )}

          {view === "list" && (
            <section className="director-card director-list-card">
              <div className="director-card-heading">
                <div>
                  <span className="eyebrow"><ListIcon size={14} /> WORK LIST</span>
                  <h2>{viewTitle}</h2>
                </div>
                <Button onClick={() => setComposer({ kind: "task" })}><Plus size={16} /> Add task</Button>
              </div>
              <div className="director-list-head"><span>Task</span><span>Status</span><span>Due</span><span>Owner</span><span /></div>
              {filteredTasks.length ? (
                filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={projectMap.get(stringValue(task.project_id))}
                    assignee={peopleById.get(stringValue(task.assignee))}
                    onOpen={() => setSelectedTask(task)}
                    onEdit={() => setComposer({ kind: "task", row: task })}
                  />
                ))
              ) : (
                <Empty title="No matching tasks" description="Change the filters or create a new task for this space." />
              )}
            </section>
          )}

          {view === "board" && (
            <section className="director-card director-board-shell">
              <div className="director-card-heading">
                <div>
                  <span className="eyebrow"><KanbanSquare size={14} /> DRAG AND DROP WORKFLOW</span>
                  <h2>Task board</h2>
                </div>
                <span className="director-board-tip">Drag a card to change its status · {filteredTasks.length} items</span>
              </div>
              <DndContext onDragEnd={handleDragEnd}>
                <div className="director-board">
                  {statuses.map((status) => (
                    <BoardColumn
                      key={status}
                      status={status}
                      tasks={filteredTasks.filter((task) => task.status === status)}
                      peopleById={peopleById}
                      onOpen={setSelectedTask}
                    />
                  ))}
                </div>
              </DndContext>
            </section>
          )}

          {view === "calendar" && (
            <section className="director-card director-calendar-shell">
              <div className="director-card-heading">
                <div>
                  <span className="eyebrow"><CalendarDays size={14} /> DEADLINE MAP</span>
                  <h2>{calendarMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
                </div>
                <div className="director-calendar-actions">
                  <Button
                    className="secondary"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={15} /> <span>Previous</span>
                  </Button>
                  <Button className="secondary" onClick={() => setCalendarMonth(new Date())}>Today</Button>
                  <Button
                    className="secondary"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    aria-label="Next month"
                  >
                    <span>Next</span> <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
              <div className="director-calendar-grid">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div className="director-calendar-label" key={day}>{day}</div>)}
                {calendarCells.map((day, index) => {
                  const dayTasks = day ? calendarTaskMap.get(day) || [] : [];
                  return (
                    <div className={"director-calendar-cell " + (day === today ? "today" : "")} key={day || "blank-" + index}>
                      {day && (
                        <>
                          <strong>{Number(day.slice(-2))}</strong>
                          {dayTasks.slice(0, 4).map((task) => (
                            <button
                              type="button"
                              className={"director-calendar-task " + (isOverdue(task, today) ? "overdue" : "")}
                              key={task.id}
                              onClick={() => setSelectedTask(task)}
                              title={entityName(task) + " · " + fullDateLabel(task.due)}
                            >
                              <i />{entityName(task)}
                            </button>
                          ))}
                          {dayTasks.length > 4 && <small className="director-calendar-more">+{dayTasks.length - 4} more</small>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {!filteredTasks.length && <Empty title="No calendar items" description="Create work or adjust your filters to see upcoming deadlines." />}
            </section>
          )}

          {view === "timeline" && (
            <section className="director-card director-timeline-shell">
              <div className="director-card-heading">
                <div>
                  <span className="eyebrow"><BarChart3 size={14} /> DELIVERY ROADMAP</span>
                  <h2>Timeline</h2>
                </div>
                <span className="director-board-tip">Sorted by deadline · {filteredTasks.length} items</span>
              </div>
              <div className="director-timeline">
                {filteredTasks.map((task) => {
                  const progress = statusProgress(task.status);
                  return (
                    <button type="button" className="director-timeline-row" key={task.id} onClick={() => setSelectedTask(task)}>
                      <span className="director-timeline-date">
                        {dateLabel(task.due)}
                        <small>{fullDateLabel(task.due)}</small>
                      </span>
                      <span className="director-timeline-track">
                        <i style={{ width: progress + "%" }} />
                        <b style={{ left: Math.max(4, Math.min(progress, 94)) + "%" }} />
                      </span>
                      <span className="director-timeline-copy">
                        <strong>{entityName(task)}</strong>
                        <small>{projectMap.get(stringValue(task.project_id)) ? entityName(projectMap.get(stringValue(task.project_id))) : "Unlinked work"} · {stringValue(task.status || "To Do")}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  );
                })}
              </div>
              {!filteredTasks.length && <Empty title="No timeline items" description="Create work or adjust your filters to see the roadmap." />}
            </section>
          )}

          {view === "workload" && (
            <section className="director-card director-workload-shell">
              <div className="director-card-heading">
                <div>
                  <span className="eyebrow"><Users size={14} /> PEOPLE AND CAPACITY</span>
                  <h2>Team workload</h2>
                </div>
                <Link className="btn secondary" to="/workload">Open full workload <ArrowRight size={15} /></Link>
              </div>
              <div className="director-workload-grid">
                {teamLoads.map(({ person, hours, open, percent }) => (
                  <article className="director-workload-card" key={person.id}>
                    <div className="director-workload-head">
                      <Avatar name={entityName(person)} role={person.role} />
                      <span><strong>{entityName(person)}</strong><small>{stringValue(person.department || person.team_id || "Team")}</small></span>
                      <Badge value={percent > 100 ? "Overloaded" : percent < 60 ? "Available" : "Balanced"} />
                    </div>
                    <div className="director-workload-number"><strong>{percent}%</strong><span>{hours}h planned · {open} open tasks</span></div>
                    <div className="director-workload-bar"><i className={percent > 100 ? "risk" : ""} style={{ width: Math.min(percent, 100) + "%" }} /></div>
                    <Link to="/people">View profile <ArrowRight size={14} /></Link>
                  </article>
                ))}
              </div>
              {!teamLoads.length && <Empty title="No people found" description="Add team members to see capacity here." />}
            </section>
          )}
        </section>
      </div>

      {composer && (
        composer.kind === "task" || composer.kind === "project" ? (
          <DirectorComposer
            key={composer.kind + "-" + (composer.row?.id || "new")}
            kind={composer.kind}
            row={composer.row}
            spaces={spaces}
            defaultSpaceId={activeSpace === "everything" ? spaces[0]?.id || "" : activeSpace}
            onSaved={notifySuccess}
            onFailed={notifyFailure}
            onClose={() => setComposer(null)}
          />
        ) : (
          <ManagementComposer
            key={composer.kind + "-" + (composer.row?.id || "new")}
            kind={composer.kind}
            row={composer.row}
            spaces={spaces}
            onSaved={notifySuccess}
            onFailed={notifyFailure}
            onClose={() => setComposer(null)}
          />
        )
      )}
      {selectedTask && <TaskPanel task={selectedTask} onClose={() => setSelectedTask(null)} />}
      {archiveClient && (
        <Modal title="Archive client?" onClose={() => setArchiveClient(null)}>
          <div className="director-confirm-dialog">
            <span className="director-confirm-icon"><Archive size={20} /></span>
            <h3>{entityName(archiveClient)}</h3>
            <p>This keeps the client history safe but removes the record from active relationship views. You can restore it later from the Clients section.</p>
            <div className="director-form-actions"><Button type="button" className="secondary" onClick={() => setArchiveClient(null)}>Cancel</Button><Button type="button" className="danger-button" onClick={archiveSelectedClient}><Archive size={15} /> Archive client</Button></div>
          </div>
        </Modal>
      )}
      {toast && <div className={"director-toast director-toast-" + toast.tone} role="status" aria-live="polite"><span>{toast.tone === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span><strong>{toast.message}</strong><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  );
}

function LayersIcon() {
  return <span className="director-layers-icon" aria-hidden="true"><span /><span /><span /></span>;
}
