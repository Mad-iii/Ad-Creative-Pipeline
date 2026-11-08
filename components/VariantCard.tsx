"use client";

import { useEffect, useRef, useState } from "react";
import { btn, btnPrimary, field } from "./ui";
import { LIMITS, passes } from "@/lib/checks";
import { RULE_LABEL, type Status, type Variant } from "@/lib/types";

const BADGE: Record<Status, { label: string; cls: string }> = {
  pending: { label: "Needs review", cls: "bg-fg/10 text-fg" },
  edited: { label: "Edited", cls: "bg-accent/15 text-accent" },
  approved: { label: "Approved", cls: "bg-ok/15 text-ok" },
  rejected: { label: "Rejected", cls: "bg-bad/15 text-bad" },
  failed_checks: { label: "Blocked by checks", cls: "bg-warn/20 text-warn" },
};

const PRESETS = ["Off-brand tone", "Claim not allowed", "Too generic", "Too long"];

const Kbd = ({ k }: { k: string }) => (
  <kbd className="ml-1.5 rounded border border-current/30 px-1 font-mono text-[10px] opacity-70">{k}</kbd>
);

function Count({ n, max }: { n: number; max: number }) {
  return <span className={`font-mono text-xs ${n > max ? "text-bad" : "text-muted"}`}>{n}/{max}</span>;
}

type Copy = { headline: string; primary: string; cta: string };

function EditForm({ v, onSave, onCancel }: { v: Variant; onSave: (p: Copy) => void; onCancel: () => void }) {
  const [d, setD] = useState<Copy>({ headline: v.headline, primary: v.primary, cta: v.cta });
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  const fields = [
    ["headline", "Headline", LIMITS.headline],
    ["primary", "Primary text", LIMITS.primary],
    ["cta", "CTA", LIMITS.cta],
  ] as const;

  const empty = !d.headline.trim() || !d.primary.trim() || !d.cta.trim();
  const same = d.headline === v.headline && d.primary === v.primary && d.cta === v.cta;

  return (
    <div
      className="mt-4 space-y-3 rounded-xl border border-line bg-bg p-4"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      {fields.map(([k, label, max]) => (
        <label key={k} className="block text-sm">
          <span className="flex justify-between font-semibold">
            {label}
            <Count n={d[k].length} max={max} />
          </span>
          {k === "primary" ? (
            <textarea
              className={field}
              rows={3}
              value={d[k]}
              onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))}
            />
          ) : (
            <input
              ref={k === "headline" ? first : undefined}
              className={field}
              value={d[k]}
              onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))}
            />
          )}
        </label>
      ))}
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={empty || same} onClick={() => onSave(d)}>
          Save changes
        </button>
        <button className={btn} onClick={onCancel}>Cancel</button>
        <span className="self-center text-xs text-muted">Checks re-run on save. Edited copy needs approval again.</span>
      </div>
    </div>
  );
}

function RejectForm({ onConfirm, onCancel }: { onConfirm: (reason: string, regen: boolean) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const ok = reason.trim().length >= 4;

  return (
    <div
      className="mt-4 space-y-3 rounded-xl border border-line bg-bg p-4"
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <label className="block text-sm font-semibold">
        Why is this rejected? (required)
        <textarea
          ref={ref}
          className={field}
          rows={2}
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" className="rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-accent" onClick={() => setReason(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} disabled={!ok} onClick={() => onConfirm(reason, true)}>Reject and regenerate</button>
        <button className={btn} disabled={!ok} onClick={() => onConfirm(reason, false)}>Reject only</button>
        <button className={btn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

type Props = {
  v: Variant;
  angle: string;
  selected: boolean;
  busy: boolean;
  panel: "edit" | "reject" | null;
  onSelect: () => void;
  onApprove: () => void;
  onReopen: () => void;
  onPanel: (m: "edit" | "reject" | null) => void;
  onEdit: (p: Copy) => void;
  onReject: (reason: string, regen: boolean) => void;
};

export default function VariantCard({
  v, angle, selected, busy, panel, onSelect, onApprove, onReopen, onPanel, onEdit, onReject,
}: Props) {
  const badge = BADGE[v.status];
  const open = v.status === "pending" || v.status === "edited" || v.status === "failed_checks";
  const canApprove = passes(v.checks) && (v.status === "pending" || v.status === "edited");

  return (
    <article
      id={`v-${v.id}`}
      onClick={onSelect}
      className={`rounded-2xl border bg-surface p-5 transition ${
        selected ? "border-accent ring-1 ring-accent" : "border-line"
      } ${v.status === "rejected" ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md border border-line px-2 py-0.5 text-muted">{angle}</span>
        <span className={`rounded-md px-2 py-0.5 font-semibold ${badge.cls}`}>{badge.label}</span>
        <span className="font-mono text-muted">v{v.version}</span>
        {v.parentId && <span className="text-muted">regenerated</span>}
        {busy && <span className="text-accent">writing a replacement…</span>}
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-line bg-bg p-4">
          <p className="text-sm">{v.primary}</p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2">
            <b className="text-[15px] leading-snug">{v.headline}</b>
            <span className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg">{v.cta}</span>
          </div>
        </div>

        <ul className="space-y-2 text-sm">
          {v.checks.map((c) => (
            <li key={c.rule} className="flex gap-2">
              <span className={c.passed ? "text-ok" : "text-bad"} aria-hidden>{c.passed ? "✓" : "✗"}</span>
              <span>
                <span className="sr-only">{c.passed ? "Passed: " : "Failed: "}</span>
                <b className="font-semibold">{RULE_LABEL[c.rule]}</b>
                <br />
                <span className="text-muted">{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {v.status === "rejected" && v.rejectReason && (
        <p className="mt-3 text-sm text-bad">Rejected: {v.rejectReason}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {open && (
          <>
            <button className={btnPrimary} disabled={!canApprove || busy} onClick={onApprove}>
              Approve<Kbd k="A" />
            </button>
            <button className={btn} disabled={busy} onClick={() => onPanel("edit")}>Edit<Kbd k="E" /></button>
            <button className={btn} disabled={busy} onClick={() => onPanel("reject")}>Reject<Kbd k="R" /></button>
            {v.status === "failed_checks" && <span className="text-xs text-muted">Fix the failing checks to approve.</span>}
          </>
        )}
        {v.status === "approved" && (
          <>
            <button className={btn} onClick={() => onPanel("edit")}>Edit</button>
            <button className={btn} onClick={onReopen}>Reopen</button>
          </>
        )}
        {v.status === "rejected" && <button className={btn} onClick={onReopen}>Reopen</button>}
      </div>

      {panel === "edit" && <EditForm v={v} onSave={onEdit} onCancel={() => onPanel(null)} />}
      {panel === "reject" && <RejectForm onConfirm={onReject} onCancel={() => onPanel(null)} />}
    </article>
  );
}