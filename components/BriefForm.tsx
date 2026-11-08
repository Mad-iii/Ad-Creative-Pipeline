"use client";

import { useState, type ChangeEvent } from "react";
import { btn, btnPrimary, field } from "./ui";
import type { Brief } from "@/lib/types";

const toLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const toWords = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

export default function BriefForm({
  brief, busy, onGenerate, onSample,
}: {
  brief: Brief;
  busy: boolean;
  onGenerate: (b: Brief) => void;
  onSample: () => void;
}) {
  const [d, setD] = useState({
    brand: brief.brand,
    product: brief.product,
    audience: brief.audience,
    tone: brief.tone,
    banned: brief.bannedWords.join(", "),
    claims: brief.allowedClaims.join("\n"),
  });

  const set = (k: keyof typeof d) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD((p) => ({ ...p, [k]: e.target.value }));

  const valid = !!(d.brand.trim() && d.product.trim() && d.audience.trim() && d.tone.trim());

  const next = (): Brief => ({
    brand: d.brand.trim(),
    product: d.product.trim(),
    audience: d.audience.trim(),
    tone: d.tone.trim(),
    bannedWords: toWords(d.banned),
    allowedClaims: toLines(d.claims),
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onGenerate(next());
      }}
    >
      <label className="text-sm font-semibold">
        Brand
        <input className={field} value={d.brand} onChange={set("brand")} maxLength={80} />
      </label>
      <label className="text-sm font-semibold">
        Tone
        <input className={field} value={d.tone} onChange={set("tone")} maxLength={120} />
      </label>
      <label className="text-sm font-semibold md:col-span-2">
        Product
        <input className={field} value={d.product} onChange={set("product")} maxLength={200} />
      </label>
      <label className="text-sm font-semibold md:col-span-2">
        Audience
        <input className={field} value={d.audience} onChange={set("audience")} maxLength={200} />
      </label>
      <label className="text-sm font-semibold">
        Banned words (comma or new line)
        <textarea className={field} rows={4} value={d.banned} onChange={set("banned")} />
      </label>
      <label className="text-sm font-semibold">
        Fact sheet: allowed claims (one per line)
        <textarea className={field} rows={4} value={d.claims} onChange={set("claims")} />
      </label>

      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" className={btnPrimary} disabled={!valid || busy}>
          {busy ? "Generating…" : "Generate with a live model"}
        </button>
        <button type="button" className={btn} onClick={onSample} disabled={busy}>
          Load cached sample
        </button>
        <span className="text-xs text-muted">
          Live mode needs OPENROUTER_API_KEY. Any number, offer or guarantee not in the fact sheet gets blocked by the
          checks.
        </span>
      </div>
    </form>
  );
}