import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  FolderKanban,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  List as ListIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Users,
  Wallet,
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
type ComposerKind = "task" | "project";

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
};

type TeamLoad = {
  person: Entity;
  hours: number;
  open: number;
  percent: number;
};

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
        {Array.from({ length: 5 }, (_, index) => (
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
}: {
  kind: ComposerKind;
  row?: Entity;
  spaces: Entity[];
  defaultSpaceId: string;
  onClose: () => void;
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
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
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
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const projects = data.projects || [];
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const spaces = useMemo(() => (data.spaces || []).length ? data.spaces || [] : DEFAULT_SPACES, [data.spaces]);
  const tasks = useMemo(() => scoped(data.tasks || [], user), [data.tasks, user]);
  const employees = data.employees || [];
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
  const collected = (data.invoices || [])
    .filter((invoice) => invoice.status === "Paid")
    .reduce((sum, invoice) => sum + numberValue(invoice.amount), 0);
  const sevenDaysFromToday = addDaysKey(today, 7);
  const soon = openTasks.filter((task) => {
    const due = dateKey(task.due);
    return Boolean(due) && due >= today && due <= sevenDaysFromToday;
  }).length;
  const totalOpenHours = openTasks.reduce((sum, task) => sum + numberValue(task.hours), 0);
  const capacity = employees.length ? Math.round((totalOpenHours / (employees.length * 40)) * 100) : 0;

  const metrics: Metric[] = [
    { label: "Open tasks", value: openTasks.length, note: soon + " due in the next 7 days", icon: CheckCircle2, tone: "blue" },
    { label: "Delivery rate", value: completion + "%", note: completed + " completed in this space", icon: TrendingUp, tone: "green" },
    { label: "At-risk items", value: overdue.length, note: overdue.length ? "Needs a decision today" : "No overdue work", icon: AlertTriangle, tone: "red" },
    { label: "Team capacity", value: capacity + "%", note: totalOpenHours + "h of active workload", icon: Users, tone: "violet" },
    { label: "Collected", value: currency(collected), note: "Paid client invoices", icon: Wallet, tone: "amber" },
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
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  const viewTitle = view === "overview" ? "Director overview" : view.charAt(0).toUpperCase() + view.slice(1) + " view";
  const hasFilters = Boolean(search || statusFilter !== "All" || priorityFilter !== "All" || assigneeFilter !== "All");
  const firstName = stringValue(user?.name || "Director").trim().split(/\s+/)[0] || "Director";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

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
          <Button className="secondary" onClick={() => setComposer({ kind: "project" })}>
            <FolderKanban size={16} /> New project
          </Button>
          <Button onClick={() => setComposer({ kind: "task" })}>
            <Plus size={17} /> New task
          </Button>
        </div>
      </header>

      <div className="director-layout">
        <aside className="director-space-rail" aria-label="Workspace spaces">
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
            <Link to="/reports"><BarChart3 size={16} /> Reports <ChevronRight size={14} /></Link>
            <Link to="/settings"><SlidersHorizontal size={16} /> Settings <ChevronRight size={14} /></Link>
          </nav>

          <div className={"director-rail-note " + (overdue.length ? "has-risk" : "")}>
            <Timer size={17} />
            <span>
              <strong>{overdue.length ? "Attention needed" : "Stay ahead"}</strong>
              <small>{overdue.length ? overdue.length + " overdue item" + (overdue.length === 1 ? "" : "s") + " need a decision." : review + " work item" + (review === 1 ? " is" : "s are") + " in review."}</small>
            </span>
          </div>
        </aside>

        <section className="director-main-column">
          <section className="director-kpi-grid" aria-label="Director workspace metrics">
            {metrics.map(({ label, value, note, icon: Icon, tone }) => (
              <article className={"director-kpi director-kpi-" + tone} key={label}>
                <span className="director-kpi-icon"><Icon size={18} /></span>
                <span className="director-kpi-label">{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
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
            <DirectorOverview
              tasks={spaceTasks}
              projects={visibleProjects}
              teamLoads={teamLoads}
              goals={goals}
              activity={activity}
              onOpenTask={setSelectedTask}
            />
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
        <DirectorComposer
          key={composer.kind + "-" + (composer.row?.id || "new")}
          kind={composer.kind}
          row={composer.row}
          spaces={spaces}
          defaultSpaceId={activeSpace === "everything" ? spaces[0]?.id || "" : activeSpace}
          onClose={() => setComposer(null)}
        />
      )}
      {selectedTask && <TaskPanel task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

function LayersIcon() {
  return <span className="director-layers-icon" aria-hidden="true"><span /><span /><span /></span>;
}