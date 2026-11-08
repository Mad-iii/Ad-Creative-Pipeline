import { NextResponse } from "next/server";
import { z } from "zod";
import { callJson, LlmError } from "@/lib/llm";
import { anglesPrompt, regenPrompt, SYSTEM, variantsPrompt } from "@/lib/prompts";
import type { Angle, RawVariant } from "@/lib/types";

export const maxDuration = 60;

const Str = (n: number) => z.string().trim().min(1).max(n);

const BriefSchema = z.object({
  brand: Str(80),
  product: Str(200),
  audience: Str(200),
  tone: Str(120),
  bannedWords: z.array(Str(40)).max(30),
  allowedClaims: z.array(Str(120)).max(15),
});

const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("batch"), brief: BriefSchema }),
  z.object({
    mode: z.literal("regen"),
    brief: BriefSchema,
    angle: z.object({ id: Str(20), name: Str(80), rationale: Str(220) }),
    previous: z.object({ headline: Str(300), primary: Str(600) }),
    reason: Str(200),
  }),
]);

const AnglesOut = z.object({
  angles: z.array(z.object({ name: z.string().min(2).max(80), rationale: z.string().min(2).max(220) })).min(3).max(8),
});

// No length caps tighter than this: over-long copy is the checks' job to catch, not the schema's.
const VariantsOut = z.object({
  variants: z
    .array(
      z.object({
        angleId: z.string(),
        headline: z.string().min(1).max(300),
        primary: z.string().min(1).max(600),
        cta: z.string().min(1).max(100),
      }),
    )
    .min(1)
    .max(40),
});

// Best-effort limiter: in-memory, so it is per serverless instance. Fine for a demo, not for production.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  const over = recent.length >= 10;
  if (!over) recent.push(now);
  hits.set(ip, recent);
  return over;
}

const vid = () => `v-${crypto.randomUUID().slice(0, 8)}`;

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Live generation is not configured on this deployment. Use the cached sample." },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) {
    return NextResponse.json({ error: "Rate limit reached. Try again in a few minutes." }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request. Check the brief fields and their lengths." }, { status: 400 });
  }

  const deadline = Date.now() + 55_000;

  try {
    if (body.mode === "batch") {
      const a = await callJson(SYSTEM, anglesPrompt(body.brief), AnglesOut, deadline);
      const angles: Angle[] = a.data.angles
        .slice(0, 5)
        .map((x, i) => ({ id: `a${i + 1}`, name: x.name.trim(), rationale: x.rationale.trim() }));

      const v = await callJson(SYSTEM, variantsPrompt(body.brief, angles), VariantsOut, deadline);
      const order = new Map(angles.map((x, i) => [x.id, i]));
      const perAngle = new Map<string, number>();
      const variants: RawVariant[] = [];

      for (const x of v.data.variants) {
        if (!order.has(x.angleId)) continue;
        const n = perAngle.get(x.angleId) ?? 0;
        if (n >= 3) continue;
        perAngle.set(x.angleId, n + 1);
        variants.push({ id: vid(), angleId: x.angleId, headline: x.headline, primary: x.primary, cta: x.cta });
      }
      if (!variants.length) throw new LlmError("The model returned no usable variants.");
      variants.sort((p, q) => (order.get(p.angleId) ?? 0) - (order.get(q.angleId) ?? 0));

      return NextResponse.json({ angles, variants, model: v.model });
    }

    const r = await callJson(
      SYSTEM,
      regenPrompt(body.brief, body.angle, body.previous, body.reason),
      VariantsOut,
      deadline,
    );
    const first = r.data.variants[0];
    const variant: RawVariant = {
      id: vid(),
      angleId: body.angle.id,
      headline: first.headline,
      primary: first.primary,
      cta: first.cta,
    };
    return NextResponse.json({ variants: [variant], model: r.model });
  } catch (e) {
    const msg = e instanceof LlmError ? e.message : "Generation failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}