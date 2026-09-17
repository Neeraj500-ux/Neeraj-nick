import { useState, type ChangeEvent } from "react";
import { Download, FileText, FolderOpen, Trash2, Upload } from "lucide-react";
import { Avatar, Button, Empty } from "../components/ui";
import { hasPermission } from "../lib/permissions";
import { scoped, useWorkspace } from "../services/workspace";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Files() {
  const { data, user, save, remove } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const rows = scoped(data.files || [], user);
  const canManage = hasPermission(user, "files.manage");

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!canManage) return setError("Only team leads and administrators can upload workspace files.");
    if (file.size > 2 * 1024 * 1024) return setError("This local workspace supports files up to 2 MB. Use a production storage bucket for larger assets.");
    setBusy(true); setError("");
    try {
      const storagePath = await readFile(file);
      await save("files", { name: file.name, status: "Uploaded", assignee: user?.id, team_id: user?.team_id, storage_path: storagePath, mime_type: file.type, size: file.size, description: formatBytes(file.size) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload the file.");
    } finally { setBusy(false); }
  };

  const download = (name: string, storagePath: unknown) => {
    if (typeof storagePath !== "string" || !storagePath) return setError("This file does not have a downloadable copy.");
    const link = document.createElement("a");
    link.href = storagePath;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="files-page">
      <header className="page-heading"><div><span className="eyebrow"><FolderOpen size={14} /> SHARED CREATIVE LIBRARY</span><h1>Files</h1><p className="muted">Keep the assets, references and documents your team needs close.</p></div>{canManage && <label className="btn upload-button"><Upload size={16} />{busy ? "Uploading…" : "Upload file"}<input type="file" onChange={(event) => void upload(event)} disabled={busy} /></label>}</header>
      <div className="files-note"><span className="files-note-icon"><ShieldIcon /></span><span><strong>Private workspace files</strong><small>Files are stored in this browser workspace for the current signed-in identity.</small></span></div>
      {error && <p className="error" role="alert">{error}</p>}
      {rows.length ? <section className="card file-list">{rows.map((file) => <article className="file-row" key={file.id}><span className="file-icon"><FileText size={21} /></span><div className="file-copy"><strong>{file.name}</strong><small>{file.description || "Workspace file"} · {file.status}</small></div><Avatar name={String((data.employees || []).find((person) => person.id === file.assignee)?.name || user?.name || "Team")} /><div className="file-actions"><Button className="secondary icon-btn" aria-label={`Download ${file.name}`} onClick={() => download(file.name, file.storage_path)}><Download size={16} /></Button>{canManage && <Button className="secondary icon-btn danger-icon" aria-label={`Delete ${file.name}`} onClick={async () => { if (!window.confirm(`Delete ${file.name}?`)) return; try { await remove("files", file.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete the file."); } }}><Trash2 size={16} /></Button>}</div></article>)}</section> : <Empty title="Your library is ready" description={canManage ? "Upload a useful reference or asset to give the team a shared starting point." : "Files shared with your scope will appear here."} />}
    </div>
  );
}

function ShieldIcon() {
  return <span aria-hidden="true">✦</span>;
}
