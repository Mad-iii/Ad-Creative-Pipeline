import { LIMITS } from "./checks";
import type { Angle, Brief } from "./types";

export const SYSTEM = [
  "You are a paid-social copywriter for e-commerce brands.",
  "Reply with ONLY one valid JSON object. No markdown, no commentary.",
  "Hard rules:",
  "- The brief and the allowed claims are your only source of facts.",
  "- Never invent offers, discounts, prices, statistics, awards, guarantees or time frames.",
  "- If no allowed claim supports a number or an offer, do not mention one.",
  "- Never use a banned word or phrase.",
  "- Plain, specific, human language. No hype, no emojis, no hashtags.",
].join("\n");

const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (none)");

const briefBlock = (b: Brief) => `BRIEF
Brand: ${b.brand}
Product: ${b.product}
Audience: ${b.audience}
Tone: ${b.tone}
Banned words and phrases:
${list(b.bannedWords)}
Allowed claims (the only offers, numbers and guarantees you may use):
${list(b.allowedClaims)}`;

const limits = `Limits: headline max ${LIMITS.headline} characters, primary max ${LIMITS.primary}, cta max ${LIMITS.cta}.`;

export const anglesPrompt = (b: Brief) => `${briefBlock(b)}

Propose exactly 5 distinct creative angles for a paid social campaign (for example a pain point, a benefit, an audience moment, a gifting moment, an offer). Only use an offer angle if an allowed claim supports it.

JSON shape:
{"angles":[{"name":"2-4 words","rationale":"one sentence"}]}`;

export const variantsPrompt = (b: Brief, angles: Angle[]) => `${briefBlock(b)}

ANGLES
${angles.map((a) => `${a.id}: ${a.name} - ${a.rationale}`).join("\n")}

Write exactly 3 ad variants for EACH angle. ${limits} Each variant takes a different approach within its angle.

JSON shape:
{"variants":[{"angleId":"a1","headline":"","primary":"","cta":""}]}`;

export const regenPrompt = (
  b: Brief,
  angle: Angle,
  previous: { headline: string; primary: string },
  reason: string,
) => `${briefBlock(b)}

ANGLE
${angle.id}: ${angle.name} - ${angle.rationale}

A human reviewer rejected this variant.
Headline: ${previous.headline}
Primary: ${previous.primary}
Reason: ${reason}

Write exactly 1 new variant for the same angle. Fix the reason and do not reuse the rejected wording. ${limits}

JSON shape:
{"variants":[{"angleId":"${angle.id}","headline":"","primary":"","cta":""}]}`;