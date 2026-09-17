import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Eye, MoreHorizontal, Pencil, Plus, Power, Search, ShieldCheck, Trash2, UserRoundCheck, Users } from "lucide-react";
import { z } from "zod";
import { Avatar, Badge, Button, Modal } from "../components/ui";
import { canManageUser, manageableRoles } from "../lib/permissions";
import { departments, roleLabels, type Entity, type Role } from "../types";
import { useWorkspace } from "../services/workspace";

const personSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters."),
  email: z.string().trim().email("Enter a valid email."),
  phone: z.string().trim().regex(/^$|^[+\d][\d\s-]{8,18}$/, "Enter a valid phone number."),
  department: z.string().min(1, "Choose a department."),
  role: z.enum(["director", "manager", "team_lead", "employee"]),
  status: z.enum(["Active", "Inactive", "On Leave"]),
  job_title: z.string().trim().max(70, "Keep the job title under 70 characters."),
  location: z.string().trim().max(70, "Keep the location under 70 characters."),
});
type PersonFormData = z.infer<typeof personSchema>;

export default function People() {
  const { user, data, save, remove } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [department, setDepartment] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [edit, setEdit] = useState<Entity | null | undefined>(undefined);
  const [view, setView] = useState<Entity | null>(null);
  const [removeRow, setRemoveRow] = useState<Entity | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const allowedRoles = manageableRoles(user.role);
  if (!allowedRoles.length) return <div className="empty"><ShieldCheck size={38} /><h1>People management is restricted</h1><p>Your role can manage work and your own profile, but not other accounts.</p></div>;

  const rows = useMemo(() => (data.employees || []).filter((person) => {
    const role = person.role as Role | undefined;
    const matchesScope = role ? canManageUser(user, { id: person.id, role, reports_to: person.reports_to, team_id: person.team_id || "" }) : false;
    const text = `${person.name} ${person.email || ""} ${person.department || ""} ${person.job_title || ""}`.toLowerCase();
    return matchesScope && text.includes(query.toLowerCase()) && (status === "All" || person.status === status) && (department === "All" || person.department === department) && (roleFilter === "All" || person.role === roleFilter);
  }), [data.employees, department, query, roleFilter, status, user]);

  const activeCount = rows.filter((person) => person.status === "Active").length;
  const editing = edit !== undefined;

  const persist = async (values: PersonFormData) => {
    if (!allowedRoles.includes(values.role)) throw new Error("You cannot assign this role.");
    await save("employees", {
      ...edit,
      id: edit?.id,
      ...values,
      team_id: values.department,
      reports_to: edit?.reports_to || user.id,
      active: values.status === "Active",
      joined_at: edit?.joined_at || new Date().toISOString().slice(0, 10),
      description: `${roleLabels[values.role]} · Reports to ${user.name}`,
    });
  };

  const toggle = async (row: Entity) => {
    setBusy(true); setNotice(""); setError("");
    try {
      await save("employees", { ...row, status: row.status === "Active" ? "Inactive" : "Active", active: row.status !== "Active" });
      setNotice(`${row.name} is now ${row.status === "Active" ? "inactive" : "active"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update the account."); }
    finally { setBusy(false); }
  };

  return (
    <div className="people-page">
      <header className="page-heading"><div><span className="eyebrow"><UserRoundCheck size={14} /> ROLE-BASED PEOPLE MANAGEMENT</span><h1>People & roles</h1><p className="muted">Manage the people within your access level and keep reporting lines clear.</p></div><Button onClick={() => setEdit(null)}><Plus size={17} /> Add person</Button></header>
      {(notice || error) && <div className={`people-notice ${error ? "danger" : "success"}`} role={error ? "alert" : "status"}>{error || notice}<button type="button" onClick={() => { setNotice(""); setError(""); }}>×</button></div>}
      <section className="card people-summary"><span><Users size={21} /></span><div><strong>{rows.length}</strong><small>People in your scope</small></div><i /><div><strong>{activeCount}</strong><small>Active accounts</small></div><i /><div className="summary-note"><strong>{allowedRoles.map((role) => roleLabels[role]).join(" · ")}</strong><small>Roles you can manage</small></div></section>
      <div className="toolbar card"><div className="search"><Search size={17} /><input aria-label="Search people" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email or department…" /></div><select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All</option>{allowedRoles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option><option>On Leave</option></select><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option>All</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></div>

      {!rows.length ? <div className="empty"><Users size={36} /><h3>No matching people</h3><p>Adjust the filters or add the first account within your scope.</p></div> : <div className="people-grid">{rows.map((row) => <article className="card people-card" key={row.id}><div className="people-card-top"><Avatar name={row.name} role={row.role} /><Badge value={row.status || "Active"} /><MoreHorizontal size={18} className="muted" /></div><h3>{row.name}</h3><p>{row.email || "No email recorded"}</p><div className="people-meta"><span>{roleLabels[row.role || "employee"]}</span><span>{row.department || row.team_id || "Unassigned"}</span></div><div className="people-card-details"><small>{row.job_title || "Workspace member"}</small><small>Joined {row.joined_at || "—"}</small></div><div className="people-actions"><button type="button" onClick={() => setView(row)}><Eye size={15} /> View</button><button type="button" onClick={() => setEdit(row)}><Pencil size={15} /> Edit</button><button type="button" disabled={busy} onClick={() => void toggle(row)}><Power size={15} /> {row.status === "Active" ? "Disable" : "Enable"}</button><button type="button" className="danger" onClick={() => setRemoveRow(row)} aria-label={`Delete ${row.name}`}><Trash2 size={15} /></button></div></article>)}</div>}

      {editing && <PersonForm roleOptions={allowedRoles} row={edit || undefined} onClose={() => setEdit(undefined)} onSave={async (values) => { setBusy(true); setError(""); try { await persist(values); setEdit(undefined); setNotice(`${roleLabels[values.role]} ${edit ? "updated" : "created"} successfully.`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save the account."); } finally { setBusy(false); } }} busy={busy} />}
      {view && <Modal title={view.name} onClose={() => setView(null)}><div className="person-detail"><Avatar name={view.name} role={view.role} /><Badge value={view.status || "Active"} /><dl><div><dt>Role</dt><dd>{roleLabels[view.role || "employee"]}</dd></div><div><dt>Email</dt><dd>{view.email || "—"}</dd></div><div><dt>Department</dt><dd>{view.department || view.team_id || "—"}</dd></div><div><dt>Job title</dt><dd>{view.job_title || "—"}</dd></div><div><dt>Joined</dt><dd>{String(view.joined_at || "—")}</dd></div></dl></div></Modal>}
      {removeRow && <Modal title="Delete this account?" onClose={() => setRemoveRow(null)}><div className="confirm-copy"><span><Trash2 size={21} /></span><p><strong>{removeRow.name}</strong> will be removed from this device workspace. The Director account is protected.</p></div><div className="flex end"><Button type="button" className="secondary" onClick={() => setRemoveRow(null)}>Cancel</Button><Button type="button" className="danger-btn" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await remove("employees", removeRow.id); setNotice(`${removeRow.name} deleted successfully.`); setRemoveRow(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete the account."); } finally { setBusy(false); } }}>{busy ? "Deleting…" : "Delete account"}</Button></div></Modal>}
    </div>
  );
}

function PersonForm({ roleOptions, row, onClose, onSave, busy }: { roleOptions: Role[]; row?: Entity; onClose: () => void; onSave: (values: PersonFormData) => Promise<void>; busy: boolean }) {
  const [form, setForm] = useState<PersonFormData>({
    name: row?.name || "",
    email: row?.email || "",
    phone: String(row?.phone || ""),
    department: row?.department || row?.team_id || departments[0],
    role: (row?.role && roleOptions.includes(row.role) ? row.role : roleOptions[0]) as Role,
    status: (row?.status as PersonFormData["status"]) || "Active",
    job_title: String(row?.job_title || ""),
    location: String(row?.location || ""),
  });
  const [validation, setValidation] = useState("");
  const field = (key: keyof PersonFormData) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm((current) => ({ ...current, [key]: event.target.value })); setValidation(""); };
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const parsed = personSchema.safeParse(form); if (!parsed.success) { setValidation(parsed.error.issues[0]?.message || "Check the form."); return; } await onSave(parsed.data); };
  return <Modal title={`${row ? "Edit" : "Add"} workspace person`} onClose={onClose}><form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>Full name *<input value={form.name} onChange={field("name")} autoFocus /></label><label>Work email *<input type="email" value={form.email} onChange={field("email")} /></label><label>Phone number<input value={form.phone} onChange={field("phone")} placeholder="+91 98765 43210" /></label><label>Job title<input value={form.job_title} onChange={field("job_title")} placeholder="e.g. Senior designer" /></label><label>Department<select value={form.department} onChange={field("department")}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label><label>Role<select value={form.role} onChange={field("role")}>{roleOptions.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select></label><label>Location<input value={form.location} onChange={field("location")} placeholder="New Delhi, India" /></label><label>Status<select value={form.status} onChange={field("status")}><option>Active</option><option>Inactive</option><option>On Leave</option></select></label></div>{validation && <p className="error" role="alert">{validation}</p>}<div className="form-note"><ShieldCheck size={14} /> This creates a workspace directory record. Firebase account creation should be handled by a trusted admin flow.</div><div className="flex end"><Button type="button" className="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save person"}</Button></div></form></Modal>;
}
