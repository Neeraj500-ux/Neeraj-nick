import { Link } from "react-router-dom";
import { ArrowLeft, LockKeyhole, ShieldAlert } from "lucide-react";
import { useWorkspace } from "../services/workspace";
import { getDashboardPath } from "../lib/permissions";

export default function AccessDenied({ title = "This area is restricted" }: { title?: string }) {
  const { user } = useWorkspace();
  const destination = getDashboardPath(user?.role);

  return (
    <section className="access-page">
      <div className="access-glow access-glow-one" aria-hidden="true" />
      <div className="access-glow access-glow-two" aria-hidden="true" />
      <span className="access-icon"><LockKeyhole size={25} /></span>
      <span className="eyebrow"><ShieldAlert size={14} /> PERMISSION CHECK</span>
      <h1>Access needs a different key.</h1>
      <p>{title}. Your workspace keeps sensitive information visible only to the people responsible for it.</p>
      <Link className="btn" to={destination}><ArrowLeft size={16} /> Return to my dashboard</Link>
    </section>
  );
}
