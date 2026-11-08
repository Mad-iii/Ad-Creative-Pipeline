"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import AuditLog from "./AuditLog";
import BriefForm from "./BriefForm";
import VariantCard from "./VariantCard";
import { btn, btnPrimary } from "./ui";
import { generateBatch, regenerate } from "@/lib/api";
import { approvedCsv, downloadCsv } from "@/lib/export";
import { FIXTURE_ANGLES, FIXTURE_BRIEF, FIXTURE_REGEN, FIXTURE_VARIANTS } from "@/lib/fixtures";
import { initialState, load, reducer, save, stamp, stats } from "@/lib/store";
import type { Brief, RawVariant, State, Variant } from "@/lib/types";

type Filter = "all" | "review" | "blocked" | "approved" | "rejected";
type Panel = { id: string; mode: "edit" | "reject" } | null;
type Notice = { kind: "error" | "info"; text: string } | null;

const FILTERS: { key: Filter; label: string; test: (v: Variant) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "review", label: "Needs review", test: (v) => v.status === "pending" || v.status === "edited" },
  { key: "blocked", label: "Blocked", test: (v) => v.status === "failed_checks" },
  { key: "approved", label: "Approved", test: (v) => v.status === "approved" },
  { key: "rejected", label: "Rejected", test: (v) => v.status === "rejected" },
];

async function nextVariant(state: State, v: Variant, reason: string): Promise<{ raw: RawVariant; model?: string }> {
  if (state.source === "live") {
    const angle = state.angles.find((a) => a.id === v.angleId);
    if (!angle) throw new Error("Angle not found for this variant.");
    const r = await regenerate(state.brief, angle, { headline: v.headline, primary: v.primary }, reason);
    return { raw: r.variant, model: r.model };
  }
  const used = state.variants.filter((x) => x.id.startsWith("rg-") && x.angleId === v.angleId).length;
  const next = FIXTURE_REGEN[v.angleId]?.[used];
  if (!next) throw new Error("No more cached alternatives for this angle. Generate with a live model for unlimited regeneration.");
  return { raw: next };
}

export default function Workspace() {
  const [state, dispatch] = useReducer(reducer, undefined, () => load() ?? initialState);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    save(state);
  }, [state]);

  const counts = useMemo(() => stats(state), [state]);
  const test = FILTERS.find((f) => f.key === filter)?.test ?? (() => true);
  const visible = state.variants.filter(test);
  const angleName = (id: string) => state.angles.find((a) => a.id === id)?.name ?? "Angle";

  const approve = (id: string) => dispatch(stamp({ type: "approve", id }));

  async function rejectVariant(v: Variant, reason: string, regen: boolean) {
    dispatch(stamp({ type: "reject", id: v.id, reason }));
    setPanel(null);
    if (!regen) return;
    setNotice(null);
    setBusy((b) => new Set(b).add(v.id));
    try {
      const r = await nextVariant(state, v, reason);
      dispatch(stamp({ type: "add_regen", parentId: v.id, raw: r.raw, model: r.model }));
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(v.id);
        return n;
      });
    }
  }

  async function onGenerate(brief: Brief) {
    setGenerating(true);
    setNotice(null);
    try {
      const r = await generateBatch(brief);
      dispatch(stamp({ type: "load_batch", brief, angles: r.angles, raw: r.variants, source: "live", model: r.model }));
      setFilter("all");
      setSelected(null);
      setPanel(null);
    } catch (e) {
      setNotice({ kind: "error", text: `${(e as Error).message} Your current batch is unchanged. You can still load the cached sample.` });
    } finally {
      setGenerating(false);
    }
  }

  function onSample() {
    dispatch(stamp({ type: "load_batch", brief: FIXTURE_BRIEF, angles: FIXTURE_ANGLES, raw: FIXTURE_VARIANTS, source: "cached" }));
    setFilter("all");
    setSelected(null);
    setPanel(null);
    setNotice({ kind: "info", text: "Cached sample loaded. A new batch clears the audit log." });
  }

  // J/K move, A approve, E edit, R reject
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const i = visible.findIndex((v) => v.id === selected);
      const cur = i >= 0 ? visible[i] : undefined;
      switch (e.key.toLowerCase()) {
        case "j":
          setSelected(visible[Math.min(visible.length - 1, i + 1)]?.id ?? null);
          break;
        case "k":
          setSelected(visible[Math.max(0, i - 1)]?.id ?? null);
          break;
        case "a":
          if (cur) approve(cur.id);
          break;
        case "e":
          if (cur) {
            e.preventDefault();
            setPanel({ id: cur.id, mode: "edit" });
          }
          break;
        case "r":
          if (cur) {
            e.preventDefault();
            setPanel({ id: cur.id, mode: "reject" });
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (selected) document.getElementById(`v-${selected}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const steps = [
    { t: "Brief", d: state.brief.brand },
    { t: "Angles", d: String(state.angles.length) },
    { t: "Variants", d: String(counts.generated) },
    { t: "Checks", d: `${counts.blocked} blocked` },
    { t: "Approval", d: `${counts.approved} approved` },
    { t: "Export", d: "CSV" },
  ];

  const tiles = [
    { k: "Generated", v: counts.generated, sub: counts.regenerated ? `+${counts.regenerated} regenerated` : "in this batch" },
    { k: "Blocked by checks", v: counts.blocked, sub: "before any human saw them" },
    { k: "Needs review", v: counts.review, sub: "passed the checks" },
    { k: "Approved", v: counts.approved, sub: "ready to export" },
    { k: "Rejected", v: counts.rejected, sub: "with a reason" },
  ];

  const fileName = `${state.brief.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-approved.csv`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="font-mono text-xs text-muted">
          SYNTHETIC BRAND · DEMO ·{" "}
          {state.source === "live" ? `LIVE · ${state.model ?? "model"}` : "CACHED SAMPLE BATCH"}
        </p>
        <h1 className="mt-2 text-[clamp(2rem,4.5vw,3.4rem)] font-bold leading-[1.05] tracking-tight">
          AI ad-creative pipeline with human approval
        </h1>
        <p className="mt-3 max-w-2xl text-muted">
          A brief goes in. Angles and ad variants come out. Code checks every variant against the brand rules. A
          human approves, edits or rejects. Only approved copy gets exported.
        </p>
      </header>

      <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((s, i) => (
          <li key={s.t} className="rounded-xl border border-line bg-surface px-3 py-2.5">
            <span className="font-mono text-xs text-accent">0{i + 1}</span>
            <b className="block text-sm">{s.t}</b>
            <small className="text-muted">{s.d}</small>
          </li>
        ))}
      </ol>

      <details className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold">1 · Brief and fact sheet</summary>
        <div className="mt-5">
          <BriefForm
            key={JSON.stringify(state.brief)}
            brief={state.brief}
            busy={generating}
            onGenerate={onGenerate}
            onSample={onSample}
          />
        </div>
      </details>

      {notice && (
        <p
          role="status"
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            notice.kind === "error" ? "border-bad/40 bg-bad/10 text-bad" : "border-line bg-surface text-muted"
          }`}
        >
          {notice.text}
        </p>
      )}
      {busy.size > 0 && <p className="mb-6 text-sm text-accent">Writing a replacement…</p>}

      <section aria-label="Angles" className="mb-8">
        <h2 className="mb-3 text-xl font-bold tracking-tight">2 · Angles</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {state.angles.map((a) => (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-4">
              <b className="block text-sm">{a.name}</b>
              <small className="text-muted">{a.rationale}</small>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Stats" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.k} className="rounded-xl border border-line bg-surface p-4">
            <small className="text-muted">{t.k}</small>
            <b className="block text-3xl leading-tight tabular-nums">{t.v}</b>
            <small className="text-muted">{t.sub}</small>
          </div>
        ))}
      </section>

      <section aria-label="Approval queue">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">3 · Approval queue</h2>
          <p className="font-mono text-xs text-muted">J/K move · A approve · E edit · R reject</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                filter === f.key ? "border-accent bg-accent font-semibold text-accent-fg" : "border-line text-muted"
              }`}
            >
              {f.label} · {state.variants.filter(f.test).length}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nothing here.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((v) => (
              <VariantCard
                key={v.id}
                v={v}
                angle={angleName(v.angleId)}
                selected={selected === v.id}
                busy={busy.has(v.id)}
                panel={panel?.id === v.id ? panel.mode : null}
                onSelect={() => setSelected(v.id)}
                onApprove={() => approve(v.id)}
                onReopen={() => dispatch(stamp({ type: "reopen", id: v.id }))}
                onPanel={(m) => setPanel(m ? { id: v.id, mode: m } : null)}
                onEdit={(patch) => {
                  dispatch(stamp({ type: "edit", id: v.id, patch }));
                  setPanel(null);
                }}
                onReject={(reason, regen) => void rejectVariant(v, reason, regen)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Export and audit" className="mt-10 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={btnPrimary}
            disabled={counts.approved === 0}
            onClick={() => downloadCsv(fileName, approvedCsv(state))}
          >
            Export {counts.approved} approved as CSV
          </button>
          <button className={btn} onClick={() => setShowAudit((s) => !s)} aria-expanded={showAudit}>
            {showAudit ? "Hide" : "Show"} audit log · {state.audit.length}
          </button>
          <button className={btn} onClick={onSample}>Reset to cached sample</button>
        </div>
        {showAudit && (
          <div className="mt-4">
            <AuditLog entries={state.audit} variants={state.variants} />
          </div>
        )}
      </section>

      <footer className="mt-10 text-sm text-muted">
        Checks run as plain code in your browser. The model never grades its own work. Copy only: this demo does not
        generate images or publish to Meta.
      </footer>
    </main>
  );
}