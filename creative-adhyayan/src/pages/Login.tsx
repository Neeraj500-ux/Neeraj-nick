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
    "auth/unauthorized-domain":
      "Add this website domain to Firebase Authentication authorized domains.",
    "auth/operation-not-allowed":
      "Enable this login method in Firebase Authentication.",
    "auth/account-exists-with-different-credential":
      "Use the sign-in method already linked to this email.",
  };

  return messages[error.code] ?? "Unable to complete the request. Try again.";
}

function GoogleMark() {
  return (
    <svg
      className="fb-google-logo"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.28-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

export default function Login() {
  const {
    user: workspaceUser,
    error: workspaceError,
    loading: checking,
    login,
    loginGoogle,
  } = useWorkspace();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 851px)").matches
    ) {
      emailRef.current?.focus({ preventScroll: true });
    }
  }, []);

  if (!checking && workspaceUser) {
    return (
      <Navigate
        to={dashboardPath[workspaceUser.role] ?? "/"}
        replace
      />
    );
  }

  const disabled = checking || busy !== null;

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    clearMessages();
    setBusy("email");

    try {
      await login(email.trim(), password);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogleLogin() {
    if (disabled) return;

    clearMessages();
    setBusy("google");

    try {
      await loginGoogle();
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
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

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setSuccess(
        "If an account exists, a password reset link will arrive in your inbox.",
      );
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="fb-login" aria-busy={checking || busy !== null}>
      <style>{styles}</style>

      <div className="fb-background-orb fb-orb-one" aria-hidden="true" />
      <div className="fb-background-orb fb-orb-two" aria-hidden="true" />

      <div className="fb-shell">
        <section className="fb-story" aria-label="Creative Crew introduction">
          <div className="fb-story-grid" aria-hidden="true" />

          <div className="fb-brand">
            <span className="fb-brand-icon">
              <Layers size={25} strokeWidth={2.2} />
            </span>
            <div className="fb-brand-copy">
              <strong>creative-crew</strong>
              <small>CREATIVE WORKSPACE</small>
            </div>
          </div>

          <div className="fb-story-content">
            <span className="fb-pill">
              <Sparkles size={13} aria-hidden="true" />
              PLAN. CREATE. GROW.
            </span>

            <h1>
              Big ideas.
              <br />
              Creative minds.
              <br />
              <span>One shared space.</span>
            </h1>

            <p className="fb-story-description">
              Welcome to creative-crew — your space to organize projects,
              collaborate with your team and turn creative ideas into meaningful
              work.
            </p>

            <div className="fb-benefits" aria-label="Workspace benefits">
              {[
                "Clear priorities",
                "Better teamwork",
                "Meaningful progress",
              ].map((item) => (
                <span key={item}>
                  <Check size={16} aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>

            <div className="fb-preview" aria-label="Illustrative creative workflow">
              <div className="fb-preview-top">
                <span className="fb-mini-brand">
                  <Layers size={15} aria-hidden="true" />
                  Creative studio
                </span>
                <span className="fb-live">
                  <i aria-hidden="true" />
                  Workspace preview
                </span>
              </div>

              <h2>A little structure. A lot of possibility.</h2>
              <p>Give your next idea a place to grow.</p>

              <div className="fb-task">
                <span className="fb-task-icon">
                  <Video size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>Bring your vision to life</strong>
                  <small>Plan your next creative project</small>
                </div>
                <span className="fb-task-tag">CREATE</span>
              </div>

              <div className="fb-task">
                <span className="fb-task-icon">
                  <BookOpen size={18} aria-hidden="true" />
                </span>
                <div>
                  <strong>Learn. Share. Keep growing.</strong>
                  <small>Keep ideas and resources together</small>
                </div>
                <Check size={17} className="fb-task-check" aria-hidden="true" />
              </div>

              <div className="fb-preview-line" />

              <div className="fb-preview-bottom">
                <span>
                  <CalendarDays size={15} aria-hidden="true" />
                  Make space for great work.
                </span>
                <span className="fb-mini-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          </div>

          <p className="fb-story-footer">Built for the way creative teams work.</p>
        </section>

        <section className="fb-panel" aria-labelledby="login-title">
          <div className="fb-security">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Secure workspace access</span>
          </div>

          <div className="fb-form-content">
            <div className="fb-welcome-icon" aria-hidden="true">
              <Layers size={27} strokeWidth={2.1} />
            </div>

            <span className="fb-form-badge">
              <Sparkles size={12} aria-hidden="true" />
              A SPACE FOR YOUR NEXT BIG IDEA
            </span>

            <h2 id="login-title">
              Welcome to your <span>workspace.</span>
            </h2>
            <p className="fb-description">
              Your ideas, your team, your workspace. Let&apos;s get back to
              creating.
            </p>

            {checking && (
              <div className="fb-session-status" role="status" aria-live="polite">
                <LoaderCircle size={18} className="fb-spin" aria-hidden="true" />
                <span>Preparing your workspace…</span>
              </div>
            )}

            {(error || workspaceError) && (
              <div className="fb-message fb-error" role="alert">
                {error || workspaceError}
              </div>
            )}

            {success && (
              <div className="fb-message fb-success" role="status">
                {success}
              </div>
            )}

            <button
              type="button"
              className="fb-google"
              onClick={() => void handleGoogleLogin()}
              disabled={disabled}
            >
              {busy === "google" ? (
                <LoaderCircle size={20} className="fb-spin" aria-hidden="true" />
              ) : (
                <GoogleMark />
              )}
              <span>
                {busy === "google" ? "Connecting to Google…" : "Continue with Google"}
              </span>
            </button>

            <div className="fb-divider">
              <span>or use your email</span>
            </div>

            <form onSubmit={handleSubmit} aria-busy={disabled}>
              <label htmlFor="login-email">Work email</label>
              <div className="fb-input">
                <Mail size={19} aria-hidden="true" />
                <input
                  ref={emailRef}
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearMessages();
                  }}
                  disabled={disabled}
                  required
                />
              </div>

              <div className="fb-password-heading">
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  className="fb-forgot"
                  onClick={() => void handleReset()}
                  disabled={disabled}
                >
                  {busy === "reset" ? "Sending…" : "Forgot password?"}
                </button>
              </div>

              <div className="fb-input">
                <LockKeyhole size={19} aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearMessages();
                  }}
                  disabled={disabled}
                  required
                />
                <button
                  type="button"
                  className="fb-toggle"
                  disabled={disabled}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>

              <button type="submit" className="fb-submit" disabled={disabled}>
                <span>
                  {(busy === "email" || checking) && (
                    <LoaderCircle size={18} className="fb-spin" aria-hidden="true" />
                  )}
                  {checking
                    ? "Preparing workspace…"
                    : busy === "email"
                      ? "Signing in…"
                      : "Enter your workspace"}
                </span>
                <ArrowRight size={19} aria-hidden="true" />
              </button>
            </form>

            <div className="fb-trust-note">
              <ShieldCheck size={14} aria-hidden="true" />
              <span>Your workspace. A secure sign-in.</span>
            </div>

            <p className="fb-help">
              Need an account? Contact your workspace administrator.
            </p>
          </div>

          <footer className="fb-footer">
            © {new Date().getFullYear()} creative-crew
            <span>Built for focused teams.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

const styles = `
.fb-login {
  --fb-navy: #172642;
  --fb-muted: #7385a2;
  --fb-blue: #2563eb;
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 32px 24px;
  background:
    radial-gradient(ellipse at 8% 10%, #dbeafe 0, transparent 45%),
    radial-gradient(ellipse at 96% 88%, #e0e7ff 0, transparent 44%),
    #f4f7fd;
  color: var(--fb-navy);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.fb-login *,
.fb-login *::before,
.fb-login *::after {
  box-sizing: border-box;
}

.fb-login button,
.fb-login input {
  font: inherit;
}

.fb-login button {
  cursor: pointer;
}

.fb-login button:disabled {
  cursor: wait;
  opacity: .68;
}

.fb-login button:focus-visible,
.fb-login input:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 3px;
}

.fb-login h1,
.fb-login h2,
.fb-login p {
  margin: 0;
}

.fb-background-orb {
  position: absolute;
  z-index: -1;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  filter: blur(70px);
  opacity: .38;
  pointer-events: none;
  animation: fb-drift 14s ease-in-out infinite alternate;
}

.fb-orb-one {
  top: -150px;
  left: -140px;
  background: #93c5fd;
}

.fb-orb-two {
  right: -140px;
  bottom: -170px;
  background: #a5b4fc;
  animation-delay: -7s;
}

.fb-shell {
  position: relative;
  z-index: 1;
  width: min(100%, 1180px);
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(420px, .92fr);
  overflow: hidden;
  border: 1px solid #ffffffd9;
  border-radius: 32px;
  background: #ffffffc7;
  box-shadow: 0 40px 100px #1e40af18, 0 8px 25px #17264208;
  animation: fb-enter .65s ease both;
}

.fb-story {
  position: relative;
  min-height: 720px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: 40px 42px 30px;
  color: #ffffff;
  background:
    radial-gradient(ellipse at 92% 3%, #60a5fa88, transparent 54%),
    linear-gradient(145deg, #173c91 0%, #2158cf 58%, #2563eb 100%);
}

.fb-story::after {
  content: "";
  position: absolute;
  right: -220px;
  bottom: -180px;
  width: 370px;
  height: 370px;
  border: 50px solid #ffffff0a;
  border-radius: 50%;
  box-shadow: 0 0 0 35px #ffffff05;
  pointer-events: none;
  animation: fb-drift 12s ease-in-out infinite alternate;
}

.fb-story-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(#ffffff08 1px, transparent 1px),
    linear-gradient(90deg, #ffffff08 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(#000, transparent 82%);
}

.fb-story > *:not(.fb-story-grid) {
  position: relative;
  z-index: 1;
}

.fb-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #ffffff !important;
}

.fb-brand-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  color: #ffffff;
  border: 1px solid #ffffff40;
  border-radius: 14px;
  background: #ffffff20;
  box-shadow: inset 0 1px 0 #ffffff30, 0 8px 20px #10285525;
  backdrop-filter: blur(18px);
}

.fb-brand-copy {
  color: #ffffff !important;
  font-size: 19px;
  line-height: 1.2;
  font-weight: 700;
}

.fb-brand-copy strong,
.fb-brand-copy small {
  color: #ffffff !important;
}

.fb-brand-copy small {
  display: block;
  margin-top: 5px;
  color: #dbeafe !important;
  font-size: 9px;
  letter-spacing: 2.5px;
  line-height: 1;
  opacity: .78;
}

.fb-story-content {
  padding: 48px 0 30px;
}

.fb-pill,
.fb-form-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  border: 1px solid #ffffff40;
  border-radius: 999px;
  line-height: 1.4;
}

.fb-pill {
  padding: 9px 13px;
  color: #eaf2ff !important;
  background: #ffffff10;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
}

.fb-story h1 {
  max-width: 560px;
  margin: 24px 0 18px;
  color: #ffffff !important;
  font-size: clamp(40px, 4.25vw, 56px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -2.8px;
}

.fb-story h1 span {
  color: #bfdbfe !important;
  background: linear-gradient(100deg, #e0f2fe, #93c5fd, #dbeafe);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% auto;
  animation: fb-gradient 8s ease infinite;
}

.fb-story-description {
  max-width: 420px;
  color: #e5efff !important;
  font-size: 14px;
  line-height: 1.85;
}

.fb-benefits {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 15px;
  margin-top: 24px;
}

.fb-benefits span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #f4f8ff !important;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.fb-benefits svg {
  width: 18px;
  height: 18px;
  padding: 2px;
  color: #ffffff;
  border-radius: 50%;
  background: #ffffff20;
}

.fb-preview {
  position: relative;
  overflow: hidden;
  margin-top: 30px;
  padding: 22px;
  color: #ffffff;
  border: 1px solid #ffffff45;
  border-radius: 22px;
  background: linear-gradient(135deg, #ffffff24, #ffffff0d);
  box-shadow: inset 0 1px 0 #ffffff30, 0 20px 42px #102c6c30;
  backdrop-filter: blur(20px);
  animation: fb-float 7s ease-in-out infinite;
  transition: transform .25s ease, background .25s ease;
}

.fb-preview::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(110deg, transparent 30%, #ffffff12 45%, transparent 60%);
  background-size: 250% 100%;
  animation: fb-gradient 9s ease infinite;
}

.fb-preview-top,
.fb-preview-bottom {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.fb-mini-brand,
.fb-live,
.fb-preview-bottom > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.fb-mini-brand {
  color: #ffffff !important;
  font-size: 11px;
  font-weight: 700;
}

.fb-live {
  color: #dbeafe !important;
  font-size: 9px;
}

.fb-live i,
.fb-mini-dots i {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ffffff36;
}

.fb-live i {
  background: #bfdbfe;
  box-shadow: 0 0 9px #bfdbfe;
}

.fb-preview h2 {
  position: relative;
  z-index: 1;
  margin: 20px 0 4px;
  color: #ffffff !important;
  font-size: 19px;
  font-weight: 750;
  line-height: 1.4;
  letter-spacing: -.5px;
}

.fb-preview > p {
  position: relative;
  z-index: 1;
  margin: 0 0 17px;
  color: #dbeafe !important;
  font-size: 12px;
  line-height: 1.6;
}

.fb-task {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  margin-top: 8px;
  padding: 13px 11px;
  color: #ffffff;
  border: 1px solid #ffffff18;
  border-radius: 13px;
  background: #ffffff0b;
  transition: transform .25s ease, background .25s ease;
}

.fb-task-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  color: #dbeafe;
  border: 1px solid #ffffff1c;
  border-radius: 10px;
  background: linear-gradient(135deg, #ffffff25, #ffffff0a);
}

.fb-task > div {
  min-width: 0;
  flex: 1;
}

.fb-task strong,
.fb-task small {
  display: block;
  color: #ffffff !important;
}

.fb-task strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fb-task small {
  margin-top: 2px;
  color: #bfdbfe !important;
  font-size: 10px;
  line-height: 1.6;
}

.fb-task-tag {
  flex: 0 0 auto;
  padding: 5px 6px;
  color: #ffffff !important;
  border: 1px solid #ffffff1d;
  border-radius: 6px;
  background: #ffffff14;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .8px;
}

.fb-task-check {
  flex: 0 0 auto;
  color: #bfdbfe;
}

.fb-preview-line {
  position: relative;
  z-index: 1;
  height: 1px;
  margin: 17px 0;
  background: #ffffff25;
}

.fb-preview-bottom > span:first-child {
  color: #dbeafe !important;
  font-size: 10px;
}

.fb-mini-dots {
  display: inline-flex;
  gap: 4px;
}

.fb-mini-dots i:first-child {
  background: #bfdbfe;
}

.fb-story-footer {
  color: #e5efff !important;
  font-size: 11px;
  letter-spacing: .25px;
  opacity: .82;
}

.fb-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 34px 46px 28px;
  background:
    radial-gradient(ellipse at 100% 0, #eff6ff99, transparent 50%),
    linear-gradient(160deg, #ffffff, #fbfdff);
}

.fb-security {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #64748b !important;
  font-size: 10px;
  letter-spacing: .2px;
}

.fb-security svg {
  flex: 0 0 auto;
  color: #2563eb;
}

.fb-form-content {
  width: 100%;
  max-width: 408px;
  margin: auto;
  padding: 34px 0 36px;
}

.fb-welcome-icon {
  position: relative;
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  margin-bottom: 21px;
  color: #2563eb;
  border: 1px solid #dbeafe;
  border-radius: 18px;
  background: linear-gradient(145deg, #ffffff, #e6f0ff);
  box-shadow: inset 0 2px 0 #ffffff, 0 10px 22px #2563eb12;
  transition: transform .3s ease;
}

.fb-welcome-icon::after {
  content: "";
  position: absolute;
  top: 6px;
  right: 6px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #60a5fa;
  box-shadow: 0 0 0 3px #ffffff;
}

.fb-form-badge {
  margin-bottom: 17px;
  padding: 7px 10px;
  color: #2563eb !important;
  border-color: #dbeafe;
  background: linear-gradient(110deg, #f0f7ff, #f8fbff);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.fb-form-content > h2 {
  color: #172642 !important;
  font-size: 38px;
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -1.8px;
  text-wrap: balance;
}

.fb-form-content > h2 span {
  color: #2563eb !important;
}

.fb-description {
  max-width: 355px;
  margin: 12px 0 25px;
  color: #7183a1 !important;
  font-size: 13px;
  line-height: 1.8;
}

.fb-session-status,
.fb-message {
  overflow-wrap: anywhere;
}

.fb-session-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 13px 15px;
  color: #2563eb !important;
  border: 1px solid #dbeafe;
  border-radius: 14px;
  background: #eff6ff;
  font-size: 12px;
  line-height: 1.6;
}

.fb-session-status svg {
  flex: 0 0 auto;
}

.fb-message {
  margin-bottom: 18px;
  padding: 13px;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.7;
  animation: fb-enter .25s ease both;
}

.fb-error {
  color: #be123c !important;
  border: 1px solid #fecdd3;
  background: #fff1f2;
}

.fb-success {
  color: #15803d !important;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
}

.fb-google,
.fb-submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 54px;
  border-radius: 14px;
  font-weight: 700;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
}

.fb-google {
  color: #3c4043 !important;
  border: 1px solid #dadce0;
  background: #ffffff;
  font-size: 13px;
  box-shadow: 0 2px 5px #17264204;
}

.fb-google-logo {
  display: block;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.fb-google > span {
  color: #3c4043 !important;
  line-height: 1.5;
}

.fb-google > .fb-spin {
  color: #4285f4;
}

.fb-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 23px 0;
  color: #94a3b8 !important;
  font-size: 10px;
  white-space: nowrap;
}

.fb-divider::before,
.fb-divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: #e8edf5;
}

.fb-login form label {
  display: block;
  color: #4b6483 !important;
  font-size: 12px;
  font-weight: 700;
}

.fb-input {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 56px;
  margin-top: 9px;
  padding: 0 14px;
  color: #8a9bb6;
  border: 1px solid #e0e7f2;
  border-radius: 14px;
  background: linear-gradient(180deg, #fbfcff, #f7faff);
  box-shadow: inset 0 1px 2px #17264203;
  transition: background .25s ease, border-color .25s ease, box-shadow .25s ease;
}

.fb-input > svg {
  flex: 0 0 auto;
  color: #8498b6;
}

.fb-input:focus-within {
  color: #2563eb;
  border-color: #60a5fa;
  background: #ffffff;
  box-shadow: 0 0 0 4px #2563eb0c, 0 4px 12px #2563eb08;
}

.fb-input input {
  width: 100%;
  min-width: 0;
  min-height: 52px;
  padding: 0;
  color: #172642 !important;
  border: 0;
  outline: 0;
  background: transparent !important;
  font-size: 16px;
}

.fb-input input::placeholder {
  color: #8e9bb0 !important;
  font-size: 13px;
  opacity: 1;
}

/* Keeps browser-saved email/password values readable and visually aligned. */
.fb-input input:-webkit-autofill,
.fb-input input:-webkit-autofill:hover,
.fb-input input:-webkit-autofill:focus {
  -webkit-text-fill-color: #172642;
  -webkit-box-shadow: 0 0 0 1000px #f8faff inset;
  caret-color: #172642;
}

.fb-input:focus-within input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
}

.fb-password-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
}

.fb-forgot,
.fb-toggle {
  border: 0;
  background: transparent;
}

.fb-forgot {
  min-height: 44px;
  padding: 4px 0;
  color: #2563eb !important;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.fb-toggle {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  padding: 6px;
  color: #8498b6;
  border-radius: 9px;
}

.fb-submit {
  position: relative;
  isolation: isolate;
  justify-content: space-between;
  margin-top: 27px;
  padding: 0 18px;
  overflow: hidden;
  color: #ffffff !important;
  border: 1px solid #ffffff1c;
  background: linear-gradient(110deg, #2158d9, #2563eb, #168bbd);
  background-size: 200% 100%;
  box-shadow: 0 10px 22px #2563eb2b, inset 0 1px 0 #ffffff35;
  font-size: 13px;
  animation: fb-gradient 7s ease infinite;
}

.fb-submit::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  transform: translateX(-120%);
  background: linear-gradient(110deg, transparent, #ffffff28, transparent);
  transition: transform .65s ease;
}

.fb-submit > span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff !important;
}

.fb-submit > svg {
  flex: 0 0 auto;
  transition: transform .25s ease;
}

.fb-trust-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 19px;
  color: #7b8ba3 !important;
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
}

.fb-trust-note svg {
  flex: 0 0 auto;
  color: #6087c1;
}

.fb-help {
  margin-top: 17px;
  padding-top: 17px;
  color: #7b8aa1 !important;
  border-top: 1px solid #edf1f7;
  font-size: 10px;
  line-height: 1.8;
  text-align: center;
}

.fb-footer {
  padding-top: 18px;
  color: #94a3b8 !important;
  border-top: 1px solid #edf1f7;
  font-size: 10px;
  line-height: 1.6;
}

.fb-footer span {
  margin-left: 5px;
  color: #a3afc0 !important;
}

.fb-spin {
  animation: fb-spin 1s linear infinite;
}

@keyframes fb-spin {
  to { transform: rotate(360deg); }
}

@keyframes fb-enter {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fb-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

@keyframes fb-drift {
  to { transform: translate(24px, 32px); }
}

@keyframes fb-gradient {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@media (hover: hover) {
  .fb-preview:hover {
    transform: translateY(-4px);
    background: linear-gradient(135deg, #ffffff2a, #ffffff12);
  }

  .fb-task:hover {
    transform: translateX(3px);
    background: #ffffff16;
  }

  .fb-google:hover:not(:disabled) {
    transform: translateY(-1px);
    border-color: #b5c9eb;
    background: #f8faff;
    box-shadow: 0 4px 12px #2563eb0b;
  }

  .fb-submit:hover:not(:disabled)::before {
    transform: translateX(120%);
  }

  .fb-submit:hover:not(:disabled) > svg {
    transform: translateX(3px);
  }

  .fb-welcome-icon:hover {
    transform: rotate(-5deg);
  }

  .fb-toggle:hover {
    color: #2563eb;
    background: #eaf1ff;
  }
}

@media (max-width: 900px) {
  .fb-login {
    align-items: flex-start;
    padding: 18px 14px;
  }

  .fb-shell {
    max-width: 620px;
    grid-template-columns: 1fr;
    border-radius: 27px;
  }

  .fb-story {
    min-height: auto;
    padding: 30px 32px 28px;
  }

  .fb-story-content {
    padding: 31px 0 0;
  }

  .fb-story h1 {
    font-size: clamp(36px, 8vw, 48px);
    letter-spacing: -2px;
  }

  .fb-story-description {
    max-width: 510px;
    font-size: 13px;
  }

  .fb-preview,
  .fb-story-footer {
    display: none;
  }

  .fb-panel {
    padding: 29px 32px 30px;
  }

  .fb-form-content {
    max-width: 460px;
    padding: 28px 0 25px;
  }

  .fb-security,
  .fb-footer {
    justify-content: center;
    text-align: center;
  }
}

@media (max-width: 540px) {
  .fb-login {
    padding: 10px;
  }

  .fb-shell {
    border-radius: 23px;
  }

  .fb-story {
    padding: 24px 22px 25px;
  }

  .fb-panel {
    padding: 25px 22px 27px;
  }

  .fb-brand {
    gap: 10px;
  }

  .fb-brand-icon {
    width: 43px;
    height: 43px;
    flex-basis: 43px;
    border-radius: 13px;
  }

  .fb-brand-copy {
    font-size: 17px;
  }

  .fb-brand-copy small {
    font-size: 8px;
  }

  .fb-story-content {
    padding-top: 25px;
  }

  .fb-pill {
    padding: 8px 10px;
    font-size: 8px;
    letter-spacing: 1px;
  }

  .fb-story h1 {
    margin: 18px 0 13px;
    font-size: clamp(31px, 9.5vw, 40px);
    line-height: 1.16;
    letter-spacing: -1.3px;
  }

  .fb-story-description {
    font-size: 12px;
    line-height: 1.72;
  }

  .fb-benefits {
    gap: 8px 11px;
    margin-top: 16px;
  }

  .fb-benefits span {
    font-size: 9px;
  }

  .fb-benefits svg {
    width: 17px;
    height: 17px;
  }

  .fb-form-content {
    padding: 27px 0 25px;
  }

  .fb-welcome-icon {
    width: 51px;
    height: 51px;
    margin-bottom: 18px;
    border-radius: 16px;
  }

  .fb-form-badge {
    margin-bottom: 15px;
    padding: 7px 9px;
    font-size: 7px;
    letter-spacing: .65px;
  }

  .fb-form-content > h2 {
    font-size: 32px;
    letter-spacing: -1.35px;
  }

  .fb-description {
    font-size: 12px;
  }

  .fb-google,
  .fb-submit {
    min-height: 56px;
  }

  .fb-input {
    min-height: 56px;
  }

  .fb-trust-note {
    font-size: 9px;
  }

  .fb-help {
    font-size: 10px;
  }

  .fb-footer span {
    display: block;
    margin: 3px 0 0;
  }
}

@media (max-width: 380px) {
  .fb-login {
    padding: 7px;
  }

  .fb-story,
  .fb-panel {
    padding-right: 17px;
    padding-left: 17px;
  }

  .fb-story h1 {
    font-size: 29px;
  }

  .fb-benefits {
    display: grid;
    grid-template-columns: 1fr;
  }

  .fb-forgot {
    font-size: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fb-login *,
  .fb-login *::before,
  .fb-login *::after {
    animation: none !important;
    transition: none !important;
  }

  .fb-spin {
    animation: fb-spin 1.5s linear infinite !important;
  }
}

/* Premium borderless finish */
.fb-shell {
  border: 0;
  background: rgba(255, 255, 255, .72);
  box-shadow:
    0 42px 110px rgba(30, 64, 175, .14),
    0 16px 36px rgba(23, 38, 66, .08),
    inset 0 1px 0 rgba(255, 255, 255, .92);
}

.fb-shell::before {
  content: "";
  position: absolute;
  z-index: 3;
  top: 0;
  left: -35%;
  width: 24%;
  height: 1px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, .95), transparent);
  filter: blur(.4px);
  animation: fb-shell-shine 9s ease-in-out infinite;
}

.fb-login::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  opacity: .32;
  background-image:
    linear-gradient(rgba(37, 99, 235, .035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37, 99, 235, .035) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: linear-gradient(to bottom, #000, transparent 78%);
}

.fb-brand-icon,
.fb-pill,
.fb-preview,
.fb-task,
.fb-task-icon,
.fb-task-tag,
.fb-welcome-icon,
.fb-form-badge,
.fb-google,
.fb-submit,
.fb-input,
.fb-message {
  border: 0 !important;
}

.fb-brand-icon {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .34),
    0 10px 24px rgba(16, 40, 85, .14);
}

.fb-pill,
.fb-form-badge {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .42), 0 8px 20px rgba(37, 99, 235, .06);
}

.fb-preview {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .25),
    0 24px 52px rgba(16, 44, 108, .24);
}

.fb-task {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
}

.fb-task-icon {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .16), 0 7px 16px rgba(16, 44, 108, .12);
}

.fb-panel {
  background:
    radial-gradient(circle at 92% 4%, rgba(219, 234, 254, .82), transparent 34%),
    linear-gradient(160deg, rgba(255, 255, 255, .98), rgba(248, 251, 255, .96));
}

.fb-security {
  width: max-content;
  max-width: 100%;
  padding: 8px 11px;
  border-radius: 999px;
  background: rgba(239, 246, 255, .74);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .94), 0 8px 20px rgba(37, 99, 235, .055);
}

.fb-welcome-icon {
  background: linear-gradient(145deg, #ffffff, #e8f1ff 70%, #dbeafe);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, .94),
    0 14px 28px rgba(37, 99, 235, .13);
}

.fb-message {
  box-shadow: 0 10px 22px rgba(23, 38, 66, .045);
}

.fb-error {
  box-shadow: inset 3px 0 0 #fb7185, 0 10px 22px rgba(190, 18, 60, .06);
}

.fb-success {
  box-shadow: inset 3px 0 0 #4ade80, 0 10px 22px rgba(21, 128, 61, .06);
}

.fb-google {
  min-height: 58px;
  background: rgba(255, 255, 255, .88);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .98),
    0 12px 28px rgba(23, 38, 66, .075);
}

.fb-google:active:not(:disabled),
.fb-submit:active:not(:disabled) {
  transform: translateY(1px) scale(.995);
}

.fb-input {
  min-height: 58px;
  background: linear-gradient(145deg, rgba(246, 249, 255, .98), rgba(239, 245, 255, .92));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .96),
    0 12px 26px rgba(23, 38, 66, .055);
}

.fb-input:focus-within {
  border: 0 !important;
  transform: translateY(-1px);
  background: #ffffff;
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, .095),
    0 16px 32px rgba(37, 99, 235, .12),
    inset 0 1px 0 rgba(255, 255, 255, .98);
}

.fb-input input,
.fb-input input:focus,
.fb-input input:active {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  appearance: none;
}

.fb-input input:-webkit-autofill,
.fb-input input:-webkit-autofill:hover,
.fb-input input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
}

.fb-toggle {
  border: 0 !important;
  border-radius: 12px;
}

.fb-submit {
  min-height: 58px;
  box-shadow:
    0 15px 30px rgba(37, 99, 235, .24),
    inset 0 1px 0 rgba(255, 255, 255, .32);
}

.fb-help,
.fb-footer {
  border-top: 0;
}

.fb-help {
  padding-top: 0;
}

.fb-footer {
  padding-top: 12px;
}

@keyframes fb-shell-shine {
  0%, 30% { transform: translateX(0); opacity: 0; }
  45% { opacity: 1; }
  70%, 100% { transform: translateX(620%); opacity: 0; }
}

@media (max-width: 900px) {
  .fb-security {
    margin-inline: auto;
  }

  .fb-form-content {
    padding-top: 24px;
  }
}

@media (max-width: 540px) {
  .fb-login {
    padding: 8px;
  }

  .fb-shell {
    box-shadow:
      0 24px 60px rgba(30, 64, 175, .13),
      0 10px 25px rgba(23, 38, 66, .07),
      inset 0 1px 0 rgba(255, 255, 255, .92);
  }

  .fb-panel {
    padding-top: 21px;
  }

  .fb-security {
    font-size: 9px;
  }

  .fb-input,
  .fb-google,
  .fb-submit {
    min-height: 56px;
  }
}
`;
