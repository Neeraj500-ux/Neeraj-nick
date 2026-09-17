import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  Layers,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { dashboardPath } from "../lib/permissions";
import { useWorkspace } from "../services/workspace";

function readableError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
  }

  const messages: Record<string, string> = {
    "auth/invalid-email": "Enter a valid work email address.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Check your internet connection and try again.",
    "auth/popup-blocked": "Allow popups in your browser and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/unauthorized-domain": "Add this website domain to Firebase Authentication authorized domains.",
    "auth/operation-not-allowed": "Enable this login method in Firebase Authentication.",
    "auth/account-exists-with-different-credential": "Use the sign-in method already linked to this email.",
  };

  return messages[error.code] ?? "Unable to complete the request. Try again.";
}

function GoogleMark() {
  return (
    <svg className="block size-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

const inputShellClass =
  "flex min-h-14 items-center gap-2.5 rounded-2xl bg-[linear-gradient(145deg,rgba(246,249,255,.98),rgba(239,245,255,.92))] px-4 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,.96),0_12px_26px_rgba(23,38,66,.055)] transition-all duration-200 focus-within:-translate-y-px focus-within:bg-white focus-within:text-blue-600 focus-within:shadow-[0_0_0_4px_rgba(37,99,235,.095),0_16px_32px_rgba(37,99,235,.12),inset_0_1px_0_rgba(255,255,255,.98)]";

export default function Login() {
  const { user: workspaceUser, error: workspaceError, loading: checking, login, loginGoogle } = useWorkspace();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 851px)").matches) {
      emailRef.current?.focus({ preventScroll: true });
    }
  }, []);

  if (!checking && workspaceUser) return <Navigate to={dashboardPath[workspaceUser.role] ?? "/"} replace />;

  const disabled = checking || busy !== null;
  function clearMessages() { setError(""); setSuccess(""); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    clearMessages();
    setBusy("email");
    try { await login(email.trim(), password); } catch (cause) { setError(readableError(cause)); } finally { setBusy(null); }
  }

  async function handleGoogleLogin() {
    if (disabled) return;
    clearMessages();
    setBusy("google");
    try { await loginGoogle(); } catch (cause) { setError(readableError(cause)); } finally { setBusy(null); }
  }

  async function handleReset() {
    if (disabled) return;
    clearMessages();
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter your work email above to reset your password.");
      return;
    }
    setBusy("reset");
    try { await sendPasswordResetEmail(auth, cleanEmail); setSuccess("If an account exists, a password reset link will arrive in your inbox."); } catch (cause) { setError(readableError(cause)); } finally { setBusy(null); }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_8%_10%,#dbeafe_0,transparent_45%),radial-gradient(ellipse_at_96%_88%,#e0e7ff_0,transparent_44%),#f4f7fd] p-2 text-[#172642] sm:p-5 lg:p-8" aria-busy={disabled}>
      <div className="pointer-events-none absolute -left-36 -top-40 size-96 rounded-full bg-blue-300/40 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-44 -right-36 size-96 rounded-full bg-indigo-300/40 blur-3xl" aria-hidden="true" />
      <div className="relative grid w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-white/80 shadow-[0_42px_110px_rgba(30,64,175,.14),0_16px_36px_rgba(23,38,66,.08),inset_0_1px_0_rgba(255,255,255,.92)] backdrop-blur-sm lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.92fr)]">
        <section className="relative hidden min-h-[720px] flex-col justify-between overflow-hidden bg-[radial-gradient(ellipse_at_92%_3%,rgba(96,165,250,.53),transparent_54%),linear-gradient(145deg,#173c91_0%,#2158cf_58%,#2563eb_100%)] px-10 py-10 text-white lg:flex" aria-label="Creative Crew introduction">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.07)_1px,transparent_1px)] bg-[size:46px_46px] opacity-40" aria-hidden="true" />
          <div className="relative flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,.34),0_10px_24px_rgba(16,40,85,.14)]"><Layers size={25} strokeWidth={2.2} /></span><div><strong className="block text-lg tracking-tight">creative-crew</strong><small className="mt-1 block text-[9px] font-bold tracking-[.2em] text-blue-100">CREATIVE WORKSPACE</small></div></div>
          <div className="relative py-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-[10px] font-black tracking-[.14em] shadow-[inset_0_1px_0_rgba(255,255,255,.42)]"><Sparkles size={13} /> PLAN. CREATE. GROW.</span>
            <h1 className="mt-5 text-5xl font-black leading-[1.08] tracking-[-.06em] xl:text-[58px]">Big ideas.<br />Creative minds.<br /><span className="text-cyan-200">One shared space.</span></h1>
            <p className="mt-5 max-w-[440px] text-sm leading-7 text-blue-100/85">Welcome to creative-crew — your space to organize projects, collaborate with your team and turn creative ideas into meaningful work.</p>
            <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2" aria-label="Workspace benefits">{["Clear priorities", "Better teamwork", "Meaningful progress"].map((item) => <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-50" key={item}><Check className="size-4 rounded-full bg-white/15 p-0.5" />{item}</span>)}</div>
            <div className="mt-9 max-w-[480px] rounded-3xl bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_24px_52px_rgba(16,44,108,.24)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 text-xs"><span className="inline-flex items-center gap-2 font-bold"><Layers size={15} /> Creative studio</span><span className="inline-flex items-center gap-1.5 text-[10px] text-blue-100"><i className="size-1.5 rounded-full bg-emerald-300" />Workspace preview</span></div>
              <h2 className="mt-6 text-2xl font-extrabold tracking-tight">A little structure. A lot of possibility.</h2><p className="mt-1 text-xs leading-6 text-blue-100/80">Give your next idea a place to grow.</p>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-3 transition hover:translate-x-1 hover:bg-white/15"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><Video size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-xs">Bring your vision to life</strong><small className="mt-1 block text-[10px] text-blue-100/80">Plan your next creative project</small></div><span className="rounded-full bg-cyan-300/20 px-2 py-1 text-[8px] font-black tracking-wider text-cyan-100">CREATE</span></div>
              <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white/10 p-3 transition hover:translate-x-1 hover:bg-white/15"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15"><BookOpen size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-xs">Learn. Share. Keep growing.</strong><small className="mt-1 block text-[10px] text-blue-100/80">Keep ideas and resources together</small></div><Check size={17} className="text-emerald-200" /></div>
              <div className="my-4 h-px bg-white/15" /><div className="flex items-center justify-between text-[10px] text-blue-100"><span className="inline-flex items-center gap-2"><CalendarDays size={15} />Make space for great work.</span><span className="flex gap-1"><i className="size-1.5 rounded-full bg-white/80" /><i className="size-1.5 rounded-full bg-white/50" /><i className="size-1.5 rounded-full bg-white/30" /></span></div>
            </div>
          </div>
          <p className="relative text-[11px] text-blue-100/75">Built for the way creative teams work.</p>
        </section>

        <section className="flex min-h-[630px] flex-col bg-[radial-gradient(circle_at_92%_4%,rgba(219,234,254,.82),transparent_34%),linear-gradient(160deg,rgba(255,255,255,.98),rgba(248,251,255,.96))] px-6 py-6 sm:px-10 sm:py-8 lg:min-h-[720px]" aria-labelledby="login-title">
          <div className="inline-flex w-fit max-w-full items-center gap-2 self-center rounded-full bg-blue-50/75 px-3 py-2 text-[10px] font-bold text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,.94),0_8px_20px_rgba(37,99,235,.055)] lg:self-end"><ShieldCheck size={16} />Secure workspace access</div>
          <div className="mx-auto flex w-full max-w-[355px] flex-1 flex-col justify-center py-8 lg:py-5">
            <div className="grid size-14 place-items-center rounded-2xl bg-[linear-gradient(145deg,#fff,#e8f1ff_70%,#dbeafe)] text-blue-600 shadow-[inset_0_2px_0_rgba(255,255,255,.94),0_14px_28px_rgba(37,99,235,.13)]"><Layers size={27} strokeWidth={2.1} /></div>
            <span className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1.5 text-[8px] font-black tracking-[.12em] text-blue-600"><Sparkles size={12} />A SPACE FOR YOUR NEXT BIG IDEA</span>
            <h2 id="login-title" className="mt-4 text-[36px] font-black leading-[1.08] tracking-[-.055em] text-[#172642]">Welcome to your <span className="text-blue-600">workspace.</span></h2><p className="mt-3 max-w-[330px] text-[13px] leading-6 text-slate-500">Your ideas, your team, your workspace. Let&apos;s get back to creating.</p>
            {checking && <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-600"><LoaderCircle size={18} className="shrink-0 animate-spin" />Preparing your workspace…</div>}
            {(error || workspaceError) && <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700 shadow-[inset_3px_0_0_#fb7185]" role="alert">{error || workspaceError}</div>}
            {success && <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700 shadow-[inset_3px_0_0_#4ade80]" role="status">{success}</div>}
            <button type="button" className="mt-6 flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-white text-[13px] font-bold text-[#3c4043] shadow-[inset_0_1px_0_rgba(255,255,255,.98),0_12px_28px_rgba(23,38,66,.075)] transition hover:-translate-y-px hover:bg-blue-50 disabled:cursor-wait disabled:opacity-70" onClick={() => void handleGoogleLogin()} disabled={disabled}>{busy === "google" ? <LoaderCircle size={20} className="animate-spin text-blue-600" /> : <GoogleMark />}{busy === "google" ? "Connecting to Google…" : "Continue with Google"}</button>
            <div className="my-5 flex items-center gap-3 text-[10px] text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200"><span>or use your email</span></div>
            <form onSubmit={handleSubmit} aria-busy={disabled}>
              <label className="block text-xs font-bold text-[#4b6483]" htmlFor="login-email">Work email</label>
              <div className={`mt-2 ${inputShellClass}`}><Mail size={19} className="shrink-0" /><input ref={emailRef} id="login-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} inputMode="email" placeholder="Enter your email address" value={email} onChange={(event) => { setEmail(event.target.value); clearMessages(); }} disabled={disabled} required className="min-w-0 flex-1 bg-transparent text-base font-medium text-[#172642] outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed" /></div>
              <div className="mt-5 flex items-center justify-between gap-3"><label className="text-xs font-bold text-[#4b6483]" htmlFor="login-password">Password</label><button type="button" className="min-h-9 text-[11px] font-bold text-blue-600 transition hover:text-blue-800 disabled:cursor-wait disabled:opacity-70" onClick={() => void handleReset()} disabled={disabled}>{busy === "reset" ? "Sending…" : "Forgot password?"}</button></div>
              <div className={`mt-2 ${inputShellClass}`}><LockKeyhole size={19} className="shrink-0" /><input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => { setPassword(event.target.value); clearMessages(); }} disabled={disabled} required className="min-w-0 flex-1 bg-transparent text-base font-medium text-[#172642] outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed" /><button type="button" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 disabled:cursor-wait disabled:opacity-70" disabled={disabled} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
              <button type="submit" className="mt-6 flex min-h-[58px] w-full items-center justify-between rounded-2xl bg-[linear-gradient(110deg,#2158d9,#2563eb,#168bbd)] px-5 text-[13px] font-bold text-white shadow-[0_15px_30px_rgba(37,99,235,.24),inset_0_1px_0_rgba(255,255,255,.32)] transition hover:-translate-y-px hover:brightness-110 disabled:cursor-wait disabled:opacity-70" disabled={disabled}><span className="flex items-center gap-2">{(busy === "email" || checking) && <LoaderCircle size={18} className="animate-spin" />}{checking ? "Preparing workspace…" : busy === "email" ? "Signing in…" : "Enter your workspace"}</span><ArrowRight size={19} /></button>
            </form>
            <div className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-500"><ShieldCheck size={14} className="shrink-0 text-blue-500" />Your workspace. A secure sign-in.</div><p className="mt-4 text-center text-[10px] leading-5 text-slate-500">Need an account? Contact your workspace administrator.</p>
          </div>
          <footer className="text-center text-[10px] leading-5 text-slate-400 lg:text-left">© {new Date().getFullYear()} creative-crew <span className="ml-1 text-slate-400">Built for focused teams.</span></footer>
        </section>
      </div>
    </main>
  );
}
