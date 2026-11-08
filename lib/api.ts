import type { Angle, Brief, RawVariant } from "./types";

async function post<T>(body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(58_000),
    });
  } catch {
    throw new Error("Could not reach the generation service.");
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status}).`);
  return data as T;
}

export const generateBatch = (brief: Brief) =>
  post<{ angles: Angle[]; variants: RawVariant[]; model: string }>({ mode: "batch", brief });

export async function regenerate(
  brief: Brief,
  angle: Angle,
  previous: { headline: string; primary: string },
  reason: string,
) {
  const r = await post<{ variants: RawVariant[]; model: string }>({ mode: "regen", brief, angle, previous, reason });
  return { variant: r.variants[0], model: r.model };
}