import { passes, runChecks } from "./checks";
import { FIXTURE_ANGLES, FIXTURE_BRIEF, FIXTURE_VARIANTS } from "./fixtures";
import type { Angle, AuditAction, AuditEntry, Brief, RawVariant, Source, State, Status, Variant } from "./types";

type Meta = { at: string; uid: string };

export type Action =
  | { type: "hydrate"; state: State }
  | ({ type: "load_batch"; brief: Brief; angles: Angle[]; raw: RawVariant[]; source: Source; model?: string } & Meta)
  | ({ type: "approve"; id: string } & Meta)
  | ({ type: "reject"; id: string; reason: string } & Meta)
  | ({ type: "edit"; id: string; patch: Partial<Pick<Variant, "headline" | "primary" | "cta">> } & Meta)
  | ({ type: "reopen"; id: string } & Meta)
  | ({ type: "add_regen"; parentId: string; raw: RawVariant; model?: string } & Meta);

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type Input = DistOmit<Exclude<Action, { type: "hydrate" }>, keyof Meta>;

// Timestamps and ids are created at dispatch time so the reducer stays pure.
export const stamp = (i: Input): Action =>
  ({ ...i, at: new Date().toISOString(), uid: crypto.randomUUID() }) as Action;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function build(raw: RawVariant, id: string, brief: Brief, earlier: Variant[], extra: Partial<Variant> = {}): Variant {
  const copy = { headline: clean(raw.headline), primary: clean(raw.primary), cta: clean(raw.cta) };
  const checks = runChecks(copy, brief, earlier.filter((v) => v.status !== "rejected"));
  const ok = passes(checks);
  return {
    id,
    angleId: raw.angleId,
    ...copy,
    status: ok ? "pending" : "failed_checks",
    checks,
    blockedOnArrival: !ok,
    version: 1,
    ...extra,
  };
}

function buildAll(raws: RawVariant[], brief: Brief, prefix: string): Variant[] {
  const out: Variant[] = [];
  raws.forEach((r, i) => out.push(build(r, r.id ?? `${prefix}-${i}`, brief, out)));
  return out;
}

export const initialState: State = {
  brief: FIXTURE_BRIEF,
  angles: FIXTURE_ANGLES,
  variants: buildAll(FIXTURE_VARIANTS, FIXTURE_BRIEF, "fx"),
  audit: [],
  source: "cached",
};

// Re-run checks on everything still open, so duplicates clear when their twin is rejected.
function recheck(variants: Variant[], brief: Brief): Variant[] {
  const out: Variant[] = [];
  for (const v of variants) {
    if (v.status === "approved" || v.status === "rejected") {
      out.push(v);
      continue;
    }
    const checks = runChecks(v, brief, out.filter((o) => o.status !== "rejected"));
    const ok = passes(checks);
    const status: Status = !ok ? "failed_checks" : v.status === "failed_checks" ? "pending" : v.status;
    out.push({ ...v, checks, status });
  }
  return out;
}

const log = (prev: AuditEntry[], m: Meta, action: AuditAction, variantId?: string, detail?: string): AuditEntry[] =>
  [{ id: m.uid, at: m.at, action, variantId, detail }, ...prev].slice(0, 300);

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return a.state;

    case "load_batch": {
      const variants = buildAll(a.raw, a.brief, a.uid);
      const blocked = variants.filter((v) => v.blockedOnArrival).length;
      const via = a.source === "live" ? (a.model ?? "live model") : "cached sample";
      return {
        brief: a.brief,
        angles: a.angles,
        variants,
        source: a.source,
        model: a.model,
        audit: log([], a, "generated", undefined, `${variants.length} variants, ${blocked} blocked by checks (${via})`),
      };
    }

    case "approve": {
      const v = s.variants.find((x) => x.id === a.id);
      if (!v || !passes(v.checks) || (v.status !== "pending" && v.status !== "edited")) return s;
      return {
        ...s,
        variants: s.variants.map((x): Variant => (x.id === a.id ? { ...x, status: "approved" } : x)),
        audit: log(s.audit, a, "approved", a.id),
      };
    }

    case "reject": {
      const v = s.variants.find((x) => x.id === a.id);
      const reason = clean(a.reason);
      if (!v || v.status === "rejected" || reason.length < 4) return s;
      const variants = s.variants.map((x): Variant =>
        x.id === a.id ? { ...x, status: "rejected", rejectReason: reason } : x,
      );
      return { ...s, variants: recheck(variants, s.brief), audit: log(s.audit, a, "rejected", a.id, reason) };
    }

    case "reopen": {
      const v = s.variants.find((x) => x.id === a.id);
      if (!v || (v.status !== "approved" && v.status !== "rejected")) return s;
      const variants = s.variants.map((x): Variant =>
        x.id === a.id ? { ...x, status: "pending", rejectReason: undefined } : x,
      );
      return { ...s, variants: recheck(variants, s.brief), audit: log(s.audit, a, "reopened", a.id) };
    }

    case "edit": {
      const v = s.variants.find((x) => x.id === a.id);
      if (!v || v.status === "rejected") return s;
      const next = {
        headline: clean(a.patch.headline ?? v.headline),
        primary: clean(a.patch.primary ?? v.primary),
        cta: clean(a.patch.cta ?? v.cta),
      };
      if (!next.headline || !next.primary || !next.cta) return s;
      const changed = (["headline", "primary", "cta"] as const).filter((k) => next[k] !== v[k]);
      if (!changed.length) return s;
      // Editing resets the decision: it has to pass checks and be approved again.
      const variants = s.variants.map((x): Variant =>
        x.id === a.id ? { ...x, ...next, status: "edited", version: x.version + 1 } : x,
      );
      return {
        ...s,
        variants: recheck(variants, s.brief),
        audit: log(s.audit, a, "edited", a.id, `changed ${changed.join(", ")}`),
      };
    }

    case "add_regen": {
      const parent = s.variants.find((x) => x.id === a.parentId);
      if (!parent) return s;
      const nv = build(
        { ...a.raw, angleId: parent.angleId },
        a.raw.id ?? `${a.uid}-r`,
        s.brief,
        s.variants,
        { parentId: parent.id, version: parent.version + 1 },
      );
      return {
        ...s,
        variants: [...s.variants, nv],
        audit: log(s.audit, a, "regenerated", nv.id, `from "${parent.headline}"${a.model ? ` via ${a.model}` : ""}`),
      };
    }
  }
}

export function stats(s: State) {
  const n = (f: (v: Variant) => boolean) => s.variants.filter(f).length;
  return {
    generated: n((v) => !v.parentId),
    regenerated: n((v) => !!v.parentId),
    blocked: n((v) => v.blockedOnArrival),
    review: n((v) => v.status === "pending" || v.status === "edited"),
    approved: n((v) => v.status === "approved"),
    rejected: n((v) => v.status === "rejected"),
  };
}

const KEY = "adpipe:v1";

export function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as State;
    return p && p.brief && Array.isArray(p.variants) && Array.isArray(p.angles) ? p : null;
  } catch {
    return null;
  }
}

export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable, ignore */
  }
}