import type { Brief, CheckResult } from "./types";

// Commonly recommended lengths for paid social. Change them here.
export const LIMITS = { headline: 40, primary: 125, cta: 20 } as const;
export const DUP_THRESHOLD = 0.7;

type Copy = { headline: string; primary: string; cta: string };
type Prior = Pick<Copy, "headline" | "primary">;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Anything that sounds like an offer, price, stat, time frame or guarantee.
const CLAIM_RE =
  /\$\s?\d[\d,.]*|\d+(?:\.\d+)?\s?%|\b\d+[-\s]?(?:day|week|hour|month|year)s?\b|\bfree\b|\bguarantee\w*|#1\b|\bbest[- ]sell\w*|\bclinically proven\b|\bdoctor[- ]recommended\b|\baward[- ]winning\b|\bnumber one\b/gi;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/guarantee\w*/g, "guarantee")
    .replace(/\b(day|week|hour|month|year)s\b/g, "$1")
    .replace(/[^a-z0-9%$]/g, "");

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9$%]+/g) ?? []);

export function similarity(a: string, b: string) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / (A.size + B.size - hit);
}

export const passes = (checks: CheckResult[]) => checks.every((c) => c.passed);

// Plain code. The model never grades its own work.
export function runChecks(c: Copy, brief: Brief, earlier: Prior[]): CheckResult[] {
  const all = `${c.headline} ${c.primary} ${c.cta}`;

  const banned = brief.bannedWords
    .map((w) => w.trim())
    .filter((w) => w && new RegExp(`\\b${escapeRe(w)}\\b`, "i").test(all));

  const sizes = [
    ["headline", c.headline.length, LIMITS.headline],
    ["primary", c.primary.length, LIMITS.primary],
    ["cta", c.cta.length, LIMITS.cta],
  ] as const;
  const tooLong = sizes.some(([, n, max]) => n > max);

  const found = Array.from(new Set((all.match(CLAIM_RE) ?? []).map((t) => t.trim().replace(/[.,]+$/, ""))));
  const facts = brief.allowedClaims.map(norm);
  const unsupported = found.filter((t) => !facts.some((f) => f.includes(norm(t))));

  let best = { score: 0, headline: "" };
  for (const p of earlier) {
    const score = similarity(`${c.headline} ${c.primary}`, `${p.headline} ${p.primary}`);
    if (score > best.score) best = { score, headline: p.headline };
  }
  const dup = best.score >= DUP_THRESHOLD;

  return [
    {
      rule: "banned_words",
      passed: banned.length === 0,
      note: banned.length ? `Contains: ${banned.join(", ")}` : "No banned words",
    },
    {
      rule: "length",
      passed: !tooLong,
      note: sizes.map(([k, n, max]) => `${k} ${n}/${max}${n > max ? " over" : ""}`).join(" · "),
    },
    {
      rule: "claims",
      passed: unsupported.length === 0,
      note: unsupported.length
        ? `Not in fact sheet: ${unsupported.join(", ")}`
        : found.length
          ? "Every claim matches the fact sheet"
          : "No offers, prices or stats mentioned",
    },
    {
      rule: "duplicate",
      passed: !dup,
      note: dup ? `${Math.round(best.score * 100)}% similar to "${best.headline}"` : "Distinct from earlier variants",
    },
  ];
}