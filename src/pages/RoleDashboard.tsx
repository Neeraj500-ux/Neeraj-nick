import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  Gauge,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, Empty } from "../components/ui";
import { canUsePath, hasPermission } from "../lib/permissions";
import { roleDescriptions, roleLabels, type Role } from "../types";
import { scoped, useWorkspace } from "../services/workspace";

type Metric = { label: string; value: string | number; note: string; icon: LucideIcon };

const roleCopy: Record<Role, { eyebrow: string; title: string; description: string }> = {
  director: {
    eyebrow: "DIRECTOR COMMAND CENTER",
    title: "See the whole picture. Set the pace.",
    description: "Organization-wide clarity for people, delivery, finance and the decisions that move creative-crew forward.",
  },
  manager: {
    eyebrow: "MANAGER DELIVERY DESK",
    title: "Turn team energy into delivery.",
    description: "Keep your department aligned, remove blockers early and give every project a confident next step.",
  },
  team_lead: {
    eyebrow: "TEAM LEAD FOCUS ROOM",
    title: "Make today’s work feel lighter.",
    description: "Guide the team through priorities, feedback and deadlines without losing the creative spark.",
  },
  employee: {
    eyebrow: "YOUR CREATIVE DESK",
    title: "Your next meaningful move starts here.",
    description: "A focused view of your tasks, projects, deadlines and the progress you are building every day.",
  },
};

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function dateLabel(value?: string) {
  if (!value) return "No deadline";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function RoleDashboard() {
  const { user, data } = useWorkspace();
  if (!user) return null;

  const tasks = scoped(data.tasks || [], user);
  const projects = user.role === "employee"
    ? (data.projects || []).filter((project) => tasks.some((task) => task.project_id === project.id))
    : scoped(data.projects || [], user);
  const team = (data.employees || []).filter((person) => {
    if (person.id === user.id) return true;
    if (user.role === "director") return person.role !== "director";
    return person.reports_to === user.id || Boolean(user.team_id && (person.team_id === user.team_id || person.department === user.team_id));
  });
  const openTasks = tasks.filter((task) => task.status !== "Completed");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const pending = tasks.filter((task) => task.status === "Internal Review" || task.status === "Revision");
  const overdue = openTasks.filter((task) => task.due && task.due.slice(0, 10) < new Date().toISOString().slice(0, 10));
  const paidRevenue = (data.invoices || []).filter((item) => item.status === "Paid").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const completion = Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100);
  const copy = roleCopy[user.role];

  const metrics: Metric[] = user.role === "director"
    ? [
      { label: "People", value: data.employees?.length || 0, note: "Across the organization", icon: Users },
      { label: "Active projects", value: projects.filter((item) => item.status !== "Completed").length, note: "Moving right now", icon: FolderKanban },
      { label: "Pending approvals", value: pending.length, note: pending.length ? "Needs a decision" : "Everything is clear", icon: ClipboardCheck },
      { label: "Collected", value: `₹${paidRevenue.toLocaleString("en-IN")}`, note: "Paid client invoices", icon: Wallet },
    ]
    : user.role === "manager"
      ? [
        { label: "Team members", value: team.length, note: "People in your scope", icon: Users },
        { label: "Active projects", value: projects.filter((item) => item.status !== "Completed").length, note: "Department momentum", icon: BriefcaseBusiness },
        { label: "Needs attention", value: overdue.length, note: overdue.length ? "Bring back into focus" : "Your team is on track", icon: Clock3 },
        { label: "Delivery rate", value: `${completion}%`, note: "Visible work completed", icon: TrendingUp },
      ]
      : user.role === "team_lead"
        ? [
          { label: "Team pulse", value: Math.max(team.length - 1, 0), note: "People connected to you", icon: Users },
          { label: "Open tasks", value: openTasks.length, note: "Still in motion", icon: BriefcaseBusiness },
          { label: "Review queue", value: pending.length, note: "Feedback to move forward", icon: ClipboardCheck },
          { label: "Completion", value: `${completion}%`, note: "Across visible work", icon: Gauge },
        ]
        : [
          { label: "My open tasks", value: openTasks.length, note: "Your current focus", icon: BriefcaseBusiness },
          { label: "My projects", value: projects.length, note: "Connected assignments", icon: FolderKanban },
          { label: "Completed", value: completedTasks.length, note: "Small wins add up", icon: CheckCircle2 },
          { label: "On-time rhythm", value: `${completion}%`, note: "Personal delivery rate", icon: TrendingUp },
        ];

  const priorityTasks = openTasks.slice().sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999"))).slice(0, 6);
  const teamPreview = team.filter((person) => person.id !== user.id).slice(0, 6);
  const canManagePeople = hasPermission(user, "users.view") && canUsePath(user, "/people");

  return (
    <div className={`role-dashboard role-dashboard-${user.role}`}>
      <section className="role-hero">
        <div className="role-hero-copy">
          <span className="eyebrow"><Sparkles size={14} /> {copy.eyebrow}</span>
          <p className="role-greeting">{greeting()}, {user.name.split(" ")[0]}.</p>
          <h1>{copy.title}</h1>
          <p className="role-hero-description">{copy.description}</p>
          <div className="role-hero-actions">
            <Link className="btn" to={user.role === "employee" ? "/my-tasks" : "/projects"}>{user.role === "employee" ? "Open my work" : "View projects"}<ArrowRight size={16} /></Link>
            {canManagePeople && <Link className="btn secondary" to="/people"><Users size={16} /> Manage people</Link>}
            {!canManagePeople && <Link className="btn secondary" to="/profile"><ShieldCheck size={16} /> Open my profile</Link>}
          </div>
        </div>
        <div className="role-hero-visual" aria-hidden="true">
          <div className="role-ring role-ring-one" /><div className="role-ring role-ring-two" />
          <div className="role-core"><ShieldCheck size={34} /><span>Trusted<br />workspace</span></div>
          <i className="role-orb orb-a" /><i className="role-orb orb-b" /><i className="role-orb orb-c" />
        </div>
      </section>

      <section className="role-stat-grid" aria-label="Workspace summary">
        {metrics.map(({ label, value, note, icon: Icon }) => <article className="card role-stat" key={label}><span className="role-stat-icon"><Icon size={20} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}
      </section>

      <section className="role-content-grid">
        <article className="card role-panel">
          <div className="section-heading"><div><span className="eyebrow">LIVE WORKFLOW</span><h3>{user.role === "employee" ? "My next moves" : "Priority work"}</h3></div><Link to={user.role === "employee" ? "/my-tasks" : "/tasks"}>View all <ArrowUpRight size={15} /></Link></div>
          {priorityTasks.length ? <div className="role-list">{priorityTasks.map((task) => <Link to="/tasks" className="role-list-row" key={task.id}><span className={`role-list-mark ${task.priority === "High" ? "hot" : ""}`} /><div><strong>{task.name}</strong><small>{task.department || user.team_id || "Creative workspace"} · {dateLabel(task.due)}</small></div><Badge value={task.status} /></Link>)}</div> : <Empty title="You are all caught up" description="There are no open tasks waiting in your current scope." />}
        </article>

        <article className="card role-panel">
          <div className="section-heading"><div><span className="eyebrow">PEOPLE PULSE</span><h3>{user.role === "employee" ? "My workspace" : "Your connected team"}</h3></div>{canManagePeople && <Link to="/people">Manage <ArrowUpRight size={15} /></Link>}</div>
          {user.role === "employee" ? <div className="role-focus-card"><span className="role-focus-icon"><Sparkles size={19} /></span><strong>{roleDescriptions[user.role]}</strong><p>Keep your profile current and your task status clear for the team.</p><Link to="/profile">Update profile <ArrowRight size={14} /></Link></div> : teamPreview.length ? <div className="role-list">{teamPreview.map((person) => <Link to="/people" className="role-list-row person" key={person.id}><Avatar name={person.name} role={person.role} /><div><strong>{person.name}</strong><small>{roleLabels[person.role || "employee"]} · {person.department || person.team_id || "Team member"}</small></div><Badge value={person.status || (person.active === false ? "Inactive" : "Active")} /></Link>)}</div> : <Empty title="No team records yet" description="People connected to your reporting line will appear here." />}
        </article>
      </section>

      <section className="role-insight-grid">
        <article className="card role-insight role-insight-dark"><div className="role-insight-icon"><TrendingUp size={19} /></div><div><span className="eyebrow">DELIVERY RHYTHM</span><h3>{completion}% of visible work is complete</h3><p>{overdue.length ? `${overdue.length} item${overdue.length > 1 ? "s" : ""} need attention before they drift.` : "The workspace is moving with a healthy, visible rhythm."}</p></div><Link to="/reports"><ArrowUpRight size={18} /></Link></article>
        <article className="card role-insight"><div className="role-insight-icon"><Clock3 size={19} /></div><div><span className="eyebrow">NEXT CHECKPOINT</span><h3>{pending.length ? `${pending.length} item${pending.length > 1 ? "s" : ""} in review` : "No review queue"}</h3><p>{pending.length ? "A clear review keeps the creative loop moving." : "You have room to focus on the next meaningful step."}</p></div><Link to="/approvals"><ArrowUpRight size={18} /></Link></article>
      </section>
    </div>
  );
}
