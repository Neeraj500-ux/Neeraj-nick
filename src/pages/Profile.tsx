import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlignLeft,
  BellRing,
  BriefcaseBusiness,
  Check,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "../components/ui";
import { roleDescriptions, roleLabels } from "../types";
import { useWorkspace, type ProfilePatch } from "../services/workspace";

type PreferenceKey =
  | "email"
  | "task_updates"
  | "approvals"
  | "announcements";

type Preferences = Record<PreferenceKey, boolean>;

type TextField =
  | "name"
  | "phone"
  | "job_title"
  | "location"
  | "bio";

type FieldShellProps = {
  icon: LucideIcon;
  children: ReactNode;
  disabled?: boolean;
  muted?: boolean;
  multiline?: boolean;
};

const defaultPreferences: Preferences = {
  email: true,
  task_updates: true,
  approvals: true,
  announcements: true,
};

const preferenceOptions: Array<
  readonly [PreferenceKey, string, string]
> = [
  [
    "task_updates",
    "Task updates",
    "When work assigned to you changes",
  ],
  [
    "approvals",
    "Approvals",
    "Reviews and feedback that need attention",
  ],
  [
    "announcements",
    "Announcements",
    "Important workspace news",
  ],
  [
    "email",
    "Email summaries",
    "A helpful digest in your inbox",
  ],
];

const cardClass =
  "rounded-[28px] border border-slate-200/70 bg-white/[0.85] p-4 shadow-[0_24px_70px_-32px_rgba(11,44,90,0.45)] backdrop-blur-2xl transition-shadow duration-300 hover:shadow-[0_28px_80px_-28px_rgba(11,44,90,0.5)] sm:p-6 lg:p-7";

const labelClass =
  "!flex !w-full !min-w-0 !max-w-none !flex-col !items-stretch !gap-2 !text-left text-[13px] font-bold text-[#274467]";

const fieldInputClass =
  "!m-0 !h-full !min-w-0 !w-full !flex-1 !border-0 !bg-transparent !p-0 !text-left !text-sm !font-semibold !text-[#10264b] !shadow-none !outline-none !ring-0 placeholder:text-slate-400 focus:!border-0 focus:!outline-none focus:!ring-0 disabled:!cursor-not-allowed disabled:!opacity-60";

const fieldShellClass =
  "group !flex w-full min-w-0 !gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition-all duration-200 hover:border-cyan-300 hover:shadow-[0_6px_20px_-12px_rgba(8,126,181,0.35)] focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10";

const labelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "stretch" as const,
  gap: "8px",
  width: "100%",
  minWidth: 0,
  maxWidth: "none",
  textAlign: "left" as const,
};

function FieldShell({
  icon: Icon,
  children,
  disabled = false,
  muted = false,
  multiline = false,
}: FieldShellProps) {
  return (
    <div
      className={[
        fieldShellClass,
        multiline
          ? "!min-h-[112px] !items-start py-3"
          : "!h-12 !items-center",
        muted ? "!bg-slate-100/90" : "!bg-white/[0.98]",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={[
          "shrink-0 text-slate-400 transition-colors duration-200 group-focus-within:text-cyan-600",
          multiline ? "mt-0.5" : "",
        ].join(" ")}
      />

      {children}
    </div>
  );
}

export default function Profile() {
  const { user, updateProfile } = useWorkspace();

  const [form, setForm] = useState<ProfilePatch>(() => ({
    name: user?.name || "",
    phone: user?.phone || "",
    job_title: user?.job_title || "",
    location: user?.location || "",
    bio: user?.bio || "",
  }));

  const [preferences, setPreferences] = useState<Preferences>(() => ({
    ...defaultPreferences,
    ...(user?.notification_preferences || {}),
  }));

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Single orchestrated entrance — runs once on mount, not per-section.
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.name || "",
      phone: user.phone || "",
      job_title: user.job_title || "",
      location: user.location || "",
      bio: user.bio || "",
    });

    setPreferences({
      ...defaultPreferences,
      ...(user.notification_preferences || {}),
    });
  }, [user?.email]);

  if (!user) return null;

  const roleName = roleLabels[user.role] || "Workspace member";

  const roleDescription =
    roleDescriptions[user.role] ||
    "A valued member of your creative workspace.";

  const update =
    (field: TextField) =>
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));

      setMessage("");
      setError("");
    };

  const updatePreference =
    (key: PreferenceKey) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setPreferences((current) => ({
        ...current,
        [key]: event.target.checked,
      }));

      setMessage("");
      setError("");
    };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) return;

    const name = String(form.name || "").trim();

    if (name.length < 2) {
      setError("Please enter your full name.");
      setMessage("");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    const cleanForm = {
      ...form,
      name,
      phone: String(form.phone || "").trim(),
      job_title: String(form.job_title || "").trim(),
      location: String(form.location || "").trim(),
      bio: String(form.bio || "").trim(),
      notification_preferences: preferences,
    };

    try {
      await updateProfile(cleanForm);

      setForm((current) => ({
        ...current,
        name: cleanForm.name,
        phone: cleanForm.phone,
        job_title: cleanForm.job_title,
        location: cleanForm.location,
        bio: cleanForm.bio,
      }));

      setMessage("Your profile is up to date.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save your profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      className="relative isolate min-h-screen min-w-0 overflow-x-hidden bg-[#f4f8ff] px-3 pb-24 pt-4 sm:px-5 sm:pt-6 lg:px-8 lg:pt-8"
      aria-busy={saving}
    >
      {/* Ambient background glow — premium depth, no motion */}
      <div
        className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -right-24 top-72 h-72 w-72 rounded-full bg-blue-400/15 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[420px] h-56 w-[420px] -translate-x-1/2 rounded-full bg-emerald-300/10 blur-3xl"
        aria-hidden="true"
      />

      <div
        className={[
          "relative z-10 mx-auto w-full max-w-7xl transition-all duration-700 ease-out",
          mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        ].join(" ")}
      >
        <header className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-7 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.2em] text-cyan-700">
              <UserRound size={15} />
              <span>Your workspace identity</span>
            </span>

            <h1 className="mt-2 break-words text-[clamp(2rem,8vw,3.1rem)] font-black leading-[1.05] tracking-[-0.05em] text-[#071a3d]">
              Profile &amp; preferences
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              Keep your details current so the right work reaches the right
              person.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-4 py-2 text-xs font-black text-emerald-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" />
            <span>Active account</span>
          </div>
        </header>

        {/* Identity hero — the one bold, memorable moment on the page */}
        <section className="relative mb-5 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#04102b] via-[#0b3264] to-[#075b69] px-5 py-7 text-white shadow-[0_30px_90px_-30px_rgba(5,38,91,0.7)] sm:px-8 sm:py-9">
          {/* Fine grain texture for a less "flat gradient card" feel */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.9) 0.6px, transparent 0.6px)",
              backgroundSize: "14px 14px",
            }}
          />

          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-cyan-200/20 bg-cyan-300/10 blur-sm"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute bottom-[-100px] right-24 h-60 w-60 rounded-full bg-cyan-300/10 blur-3xl"
            aria-hidden="true"
          />

          <div
            className="pointer-events-none absolute -left-10 bottom-[-60px] h-44 w-44 rounded-full bg-emerald-300/10 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 flex min-w-0 flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="relative grid h-[84px] w-[84px] shrink-0 place-items-center rounded-[26px] bg-gradient-to-br from-cyan-300 via-emerald-300 to-blue-500 p-[3px] shadow-[0_16px_36px_rgba(34,211,238,0.35)]">
              <div className="grid h-full w-full place-items-center overflow-hidden rounded-[22px] bg-[#0b2855]">
                <Avatar name={user.name} role={user.role} />
              </div>

              <span
                className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border-[3px] border-[#0b315c] bg-emerald-400 text-[#06233f] shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
                aria-label="Verified active account"
              >
                <Check size={12} strokeWidth={3.25} />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-cyan-200">
                <Sparkles size={12} className="shrink-0" />
                {roleName} access
              </span>

              <h2
                className="mt-1 break-words !text-2xl font-black leading-tight tracking-[-0.04em] !text-white sm:!text-[2.15rem]"
                style={{ color: "#ffffff" }}
              >
                {user.name}
              </h2>

              <p className="mt-1.5 max-w-xl break-words text-xs leading-5 !text-blue-100/90 sm:text-sm">
                {roleDescription}
              </p>

              <div className="mt-3.5 flex min-w-0 flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full border border-cyan-200/30 bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-50 backdrop-blur">
                  {roleName}
                </span>

                <span className="max-w-full break-all text-[11px] text-blue-100/80">
                  {user.email}
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 text-cyan-200/25 sm:block">
              <ShieldCheck size={68} strokeWidth={1} />
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
          <form
            className={cardClass}
            onSubmit={submit}
            noValidate
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-black tracking-[0.2em] text-cyan-700">
                  Personal details
                </span>

                <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071a3d]">
                  About you
                </h3>
              </div>

              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-700">
                <BriefcaseBusiness size={19} />
              </span>
            </div>

            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <label
                className={labelClass}
                style={labelStyle}
                htmlFor="profile-name"
              >
                <span>Full name</span>

                <FieldShell icon={UserRound} disabled={saving}>
                  <input
                    id="profile-name"
                    name="name"
                    value={form.name || ""}
                    onChange={update("name")}
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                    disabled={saving}
                    className={fieldInputClass}
                  />
                </FieldShell>
              </label>

              <label
                className={labelClass}
                style={labelStyle}
                htmlFor="profile-email"
              >
                <span>Work email</span>

                <FieldShell icon={Mail} muted>
                  <input
                    id="profile-email"
                    name="email"
                    value={user.email}
                    readOnly
                    autoComplete="email"
                    className={`${fieldInputClass} !text-slate-500`}
                  />
                </FieldShell>
              </label>

              <label
                className={labelClass}
                style={labelStyle}
                htmlFor="profile-phone"
              >
                <span>Phone number</span>

                <FieldShell icon={Phone} disabled={saving}>
                  <input
                    id="profile-phone"
                    name="phone"
                    value={form.phone || ""}
                    onChange={update("phone")}
                    placeholder="+91 98765 43210"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    disabled={saving}
                    className={fieldInputClass}
                  />
                </FieldShell>
              </label>

              <label
                className={labelClass}
                style={labelStyle}
                htmlFor="profile-job-title"
              >
                <span>Job title</span>

                <FieldShell
                  icon={BriefcaseBusiness}
                  disabled={saving}
                >
                  <input
                    id="profile-job-title"
                    name="job_title"
                    value={form.job_title || ""}
                    onChange={update("job_title")}
                    placeholder="Your role in the studio"
                    autoComplete="organization-title"
                    maxLength={80}
                    disabled={saving}
                    className={fieldInputClass}
                  />
                </FieldShell>
              </label>

              <label
                className={labelClass}
                style={labelStyle}
                htmlFor="profile-department"
              >
                <span>Department</span>

                <FieldShell icon={BriefcaseBusiness} muted>
                  <input
                    id="profile-department"
                    value={user.department || user.team_id || "Not assigned"}
                    readOnly
                    className={`${fieldInputClass} !text-slate-500`}
                  />
                </FieldShell>
              </label>

              <label
                className={labelClass}
                style={labelStyle}
                htmlFor="profile-location"
              >
                <span>Location</span>

                <FieldShell icon={MapPin} disabled={saving}>
                  <input
                    id="profile-location"
                    name="location"
                    value={form.location || ""}
                    onChange={update("location")}
                    placeholder="New Delhi, India"
                    autoComplete="address-level2"
                    maxLength={100}
                    disabled={saving}
                    className={fieldInputClass}
                  />
                </FieldShell>
              </label>
            </div>

            <label
              className={`${labelClass} mt-5`}
              style={labelStyle}
              htmlFor="profile-bio"
            >
              <span>Short bio</span>

              <FieldShell
                icon={AlignLeft}
                multiline
                disabled={saving}
              >
                <textarea
                  id="profile-bio"
                  name="bio"
                  value={form.bio || ""}
                  onChange={update("bio")}
                  rows={4}
                  maxLength={240}
                  placeholder="A short note about what you do best…"
                  disabled={saving}
                  className={`${fieldInputClass} !h-auto !min-h-[84px] !resize-none !pt-0`}
                />
              </FieldShell>

              <span className="text-right text-[11px] font-normal text-slate-400">
                {(form.bio || "").length}/240
              </span>
            </label>

            <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-xs leading-5 text-slate-500">
                Role and permissions are managed by your workspace
                administrator.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0756a5] via-[#087eb5] to-[#079fba] px-5 text-sm font-black text-white shadow-[0_14px_28px_-10px_rgba(7,116,180,0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-10px_rgba(7,116,180,0.95)] hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Save size={17} />
                <span>{saving ? "Saving…" : "Save changes"}</span>
              </button>
            </div>

            {error && (
              <p
                className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                role="status"
              >
                {message}
              </p>
            )}
          </form>

          <aside className="min-w-0 space-y-5">
            <section className={cardClass}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-black tracking-[0.2em] text-cyan-700">
                    Account details
                  </span>

                  <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071a3d]">
                    Your access
                  </h3>
                </div>

                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-700">
                  <ShieldCheck size={19} />
                </span>
              </div>

              <dl className="divide-y divide-slate-100">
                <div className="flex items-start justify-between gap-4 py-3 first:pt-0 sm:items-center">
                  <dt className="shrink-0 text-sm text-slate-500">Role</dt>

                  <dd className="break-words text-right text-sm font-black text-slate-800">
                    {roleName}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4 py-3 sm:items-center">
                  <dt className="shrink-0 text-sm text-slate-500">
                    Reporting line
                  </dt>

                  <dd className="max-w-[62%] break-words text-right text-sm font-black text-slate-800">
                    {user.reports_to || "Workspace leadership"}
                  </dd>
                </div>

                <div className="flex items-start justify-between gap-4 py-3 sm:items-center">
                  <dt className="shrink-0 text-sm text-slate-500">Joined</dt>

                  <dd className="break-words text-right text-sm font-black text-slate-800">
                    {user.joined_at || "Not recorded"}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
                  <dt className="text-sm text-slate-500">Account</dt>

                  <dd className="inline-flex items-center gap-2 text-sm font-black text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Active</span>
                  </dd>
                </div>
              </dl>
            </section>

            <section className={cardClass}>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <span className="text-[11px] font-black tracking-[0.2em] text-cyan-700">
                    Notifications
                  </span>

                  <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071a3d]">
                    Stay in the loop
                  </h3>
                </div>

                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-blue-50 text-cyan-700">
                  <BellRing size={19} />
                </span>
              </div>

              <p className="mb-4 text-sm leading-6 text-slate-500">
                Choose the updates that help you keep momentum.
              </p>

              <div className="divide-y divide-slate-100">
                {preferenceOptions.map(([key, label, note]) => (
                  <label
                    key={key}
                    className={`flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 ${
                      saving
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer"
                    }`}
                  >
                    <span className="min-w-0">
                      <strong className="block text-sm font-black text-slate-800">
                        {label}
                      </strong>

                      <small className="mt-1 block text-xs leading-5 text-slate-500">
                        {note}
                      </small>
                    </span>

                    <span className="relative inline-flex h-6 w-11 shrink-0">
                      <input
                        type="checkbox"
                        name={`notification-${key}`}
                        checked={preferences[key]}
                        onChange={updatePreference(key)}
                        disabled={saving}
                        className="peer sr-only"
                      />

                      <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors duration-200 peer-checked:bg-gradient-to-r peer-checked:from-cyan-500 peer-checked:to-blue-500 peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-500/20" />

                      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className={`${cardClass} flex items-center gap-4`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25">
                <MapPin size={20} />
              </span>

              <div className="min-w-0">
                <strong className="block text-sm font-black text-slate-800">
                  Workspace location
                </strong>

                <p className="mt-1 break-words text-sm text-slate-500">
                  {form.location || "Set your location above"}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}