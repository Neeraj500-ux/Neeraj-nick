import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { confirmPasswordReset, updatePassword, verifyPasswordResetCode } from "firebase/auth";
import { Check, KeyRound, LockKeyhole, Mail, Save, Settings2, ShieldCheck } from "lucide-react";
import { auth } from "../lib/firebase";
import { roleLabels } from "../types";
import { useWorkspace } from "../services/workspace";
import { Avatar, Button } from "../components/ui";

function passwordError(cause: unknown): string {
  if (cause instanceof FirebaseError) {
    if (cause.code === "auth/requires-recent-login") return "For security, sign in again before changing your password.";
    if (cause.code === "auth/weak-password") return "Use a stronger password with at least 10 characters.";
    if (cause.code === "auth/expired-action-code" || cause.code === "auth/invalid-action-code") return "This password reset link has expired. Request a new one from the sign-in page.";
    return cause.message;
  }
  return cause instanceof Error ? cause.message : "Unable to update the password.";
}

export default function Settings() {
  const { user, data, save } = useWorkspace();
  const existing = (data.settings || [])[0];
  const [name, setName] = useState(existing?.name || "creative-crew");
  const [description, setDescription] = useState(existing?.description || "One Platform. Every Skill You Need.");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const saveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await save("settings", { id: existing?.id, name: name.trim(), description: description.trim(), status: "Active" });
      setMessage("Workspace settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password.length < 10) return setError("Use at least 10 characters for your new password.");
    if (password !== confirm) return setError("The passwords do not match.");
    if (!auth.currentUser) return setError("Your Firebase session is not available. Sign in again.");
    setSaving(true);
    try {
      await updatePassword(auth.currentUser, password);
      setPassword("");
      setConfirm("");
      setMessage("Password updated successfully.");
    } catch (cause) {
      setError(passwordError(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="page-heading"><div><span className="eyebrow"><Settings2 size={14} /> WORKSPACE CONTROL</span><h1>Settings</h1><p className="muted">Keep the workspace identity and your account security in good shape.</p></div><span className="settings-security"><ShieldCheck size={16} /> Firebase secured</span></header>
      {(message || error) && <div className={`settings-message ${error ? "danger" : "success"}`} role={error ? "alert" : "status"}>{error || message}<button type="button" onClick={() => { setMessage(""); setError(""); }}>×</button></div>}
      <div className="settings-grid">
        <section className="card settings-card">
          <div className="card-heading"><div><span className="eyebrow">WORKSPACE IDENTITY</span><h3>Company profile</h3></div><span className="heading-icon"><Settings2 size={18} /></span></div>
          <form onSubmit={saveCompany}>
            <label>Company name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Brand statement<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
            <label>Office address<textarea readOnly className="readonly" value="Building No. 532/1, First Floor, Bank Colony Deoli Village, New Delhi-110062" /></label>
            <Button disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save workspace"}</Button>
          </form>
        </section>

        <section className="card settings-card">
          <div className="card-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h3>Security & access</h3></div><span className="heading-icon"><LockKeyhole size={18} /></span></div>
          <div className="account-summary"><Avatar name={user.name} role={user.role} /><div><strong>{user.name}</strong><small>{user.email}</small></div><span className="account-check"><Check size={14} /></span></div>
          <div className="settings-role"><span>Current role</span><strong>{roleLabels[user.role]}</strong><small>{user.role === "director" ? "Full organization access" : "Managed workspace access"}</small></div>
          <h3 className="settings-subtitle">Change password</h3>
          <form onSubmit={changePassword}>
            <label>New password<input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" required /></label>
            <label>Confirm password<input type="password" minLength={10} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat your password" required /></label>
            <Button className="secondary" disabled={saving}><KeyRound size={16} /> Update password</Button>
          </form>
          <p className="settings-help"><Mail size={14} /> Need help? <a href="mailto:Contact@creativeadhyayan.com">Contact creative-crew</a></p>
        </section>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const code = params.get("oobCode") || "";
  const [validating, setValidating] = useState(Boolean(code));
  const [valid, setValid] = useState(Boolean(code));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    void verifyPasswordResetCode(auth, code).then(() => setValid(true)).catch((cause) => { setValid(false); setError(passwordError(cause)); }).finally(() => setValidating(false));
  }, [code]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!code || !valid) return setError("Open the password reset link from your email to continue.");
    if (password.length < 10) return setError("Use at least 10 characters for your new password.");
    if (password !== confirm) return setError("The passwords do not match.");
    try {
      await confirmPasswordReset(auth, code, password);
      setMessage("Password updated. You can now sign in to your workspace.");
      setPassword("");
      setConfirm("");
    } catch (cause) {
      setError(passwordError(cause));
    }
  };

  return (
    <main className="reset-screen"><section className="reset-card card"><span className="reset-icon"><LockKeyhole size={23} /></span><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Choose a new password</h1><p className="muted">Secure your Creative Adhyayan account with a fresh password.</p>{validating && <p className="auth-status"><span className="spin" /> Checking reset link…</p>}{error && <p className="error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}{!message && <form onSubmit={submit}><label>New password<input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={validating || !valid} /></label><label>Confirm password<input type="password" minLength={10} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={validating || !valid} /></label><Button disabled={validating || !valid}><KeyRound size={16} /> Save password</Button></form>}<Link className="reset-back" to="/login">Back to sign in</Link></section></main>
  );
}
