import type { AuditAction, AuditEntry, Variant } from "@/lib/types";

const TONE: Record<AuditAction, string> = {
  generated: "bg-fg/10 text-fg",
  approved: "bg-ok/15 text-ok",
  rejected: "bg-bad/15 text-bad",
  edited: "bg-accent/15 text-accent",
  reopened: "bg-fg/10 text-fg",
  regenerated: "bg-accent/15 text-accent",
};

export default function AuditLog({ entries, variants }: { entries: AuditEntry[]; variants: Variant[] }) {
  if (!entries.length) return <p className="text-sm text-muted">No decisions yet.</p>;
  const title = (id?: string) => (id ? (variants.find((v) => v.id === id)?.headline ?? "(removed)") : "Batch");

  return (
    <ol className="divide-y divide-line text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
          <time className="font-mono text-xs text-muted">{new Date(e.at).toLocaleTimeString()}</time>
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${TONE[e.action]}`}>{e.action}</span>
          <span className="font-medium">{title(e.variantId)}</span>
          {e.detail && <span className="text-muted">{e.detail}</span>}
        </li>
      ))}
    </ol>
  );
}