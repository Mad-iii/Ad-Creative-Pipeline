import type { z } from "zod";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const FALLBACK_MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-3-27b-it:free"];

export class LlmError extends Error {}

const modelList = () =>
  (process.env.OPENROUTER_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no json");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Failover: per model, one retry if the JSON is invalid, then the next model.
// Network or HTTP errors skip straight to the next model.
export async function callJson<T>(
  system: string,
  user: string,
  schema: z.ZodType<T>,
  deadline: number,
): Promise<{ data: T; model: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new LlmError("OPENROUTER_API_KEY is not set.");

  const configured = modelList();
  const failures: string[] = [];

  for (const model of configured.length ? configured : FALLBACK_MODELS) {
    let nudge = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 4_000) throw new LlmError(`Ran out of time. ${failures.join("; ")}`);

      let text: string | undefined;
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "X-Title": "Ad Creative Pipeline",
          },
          body: JSON.stringify({
            model,
            temperature: 0.8,
            max_tokens: 2500,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user + nudge },
            ],
          }),
          signal: AbortSignal.timeout(Math.min(25_000, left)),
        });
        if (!res.ok) {
          failures.push(`${model} HTTP ${res.status}`);
          break;
        }
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        text = body.choices?.[0]?.message?.content;
      } catch (e) {
        failures.push(`${model} ${e instanceof Error ? e.name : "error"}`);
        break;
      }

      if (!text) {
        failures.push(`${model} empty reply`);
        break;
      }

      try {
        const parsed = schema.safeParse(extractJson(text));
        if (parsed.success) return { data: parsed.data, model };
        failures.push(`${model} wrong shape`);
      } catch {
        failures.push(`${model} invalid JSON`);
      }
      nudge = "\n\nYour last reply was not valid JSON in the required shape. Reply with ONLY the JSON object.";
    }
  }
  throw new LlmError(`All models failed: ${failures.join("; ")}`);
}