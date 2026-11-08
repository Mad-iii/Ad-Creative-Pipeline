import type { Angle, Brief, RawVariant } from "./types";

export const FIXTURE_BRIEF: Brief = {
  brand: "Ridgeline Bottles",
  product: "Summit 750, a 750 ml insulated stainless-steel water bottle",
  audience: "Active 25-40 year-olds who hike, bike to work and want to stop buying plastic bottles",
  tone: "Confident, practical, a little dry. No hype.",
  bannedWords: ["miracle", "guaranteed results", "best in the world", "cheap"],
  allowedClaims: ["20% off your first order", "Free shipping over $50", "30-day returns", "Keeps drinks cold 24 hours"],
};

export const FIXTURE_ANGLES: Angle[] = [
  { id: "a1", name: "Cold all day", rationale: "Lead with what the bottle does best: drinks stay cold from morning to night." },
  { id: "a2", name: "Ditch single-use", rationale: "Speak to the plastic-bottle habit the audience already wants to break." },
  { id: "a3", name: "Gift that gets used", rationale: "Position the Summit 750 as a practical gift people keep using." },
  { id: "a4", name: "First-order offer", rationale: "Use the approved first-order offer to lower the barrier to a first purchase." },
  { id: "a5", name: "Built for the trail", rationale: "Show the bottle in real moments: hikes, commutes and long days out." },
];

// 15 variants. 4 are written to fail on purpose: banned word, length, unsupported claim, near-duplicate.
export const FIXTURE_VARIANTS: RawVariant[] = [
  { id: "fx1", angleId: "a1", headline: "Cold at 6 a.m. Still cold at 6 p.m.", primary: "The Summit 750 keeps drinks cold 24 hours, so your water is ready whenever you are.", cta: "Shop the Summit" },
  { id: "fx2", angleId: "a1", headline: "Ice that outlasts your commute", primary: "Pack it once, sip cold all day. The Summit 750 holds the chill from morning to night.", cta: "Shop now" },
  { id: "fx3", angleId: "a1", headline: "The miracle bottle for cold drinks", primary: "Say goodbye to warm water. Summit 750 keeps every sip cold.", cta: "Learn more" },

  { id: "fx4", angleId: "a2", headline: "Retire the plastic bottle habit", primary: "One Summit 750 replaces the pile of single-use bottles in your recycling bin.", cta: "Make the switch" },
  { id: "fx5", angleId: "a2", headline: "Less plastic. More everything else.", primary: "Built from stainless steel to last through years of refills. Free shipping over $50.", cta: "See the bottle" },
  { id: "fx6", angleId: "a2", headline: "The reusable bottle that finally makes you stop buying disposable plastic ones", primary: "Summit 750: built to be refilled every day, wherever the day takes you.", cta: "Shop the Summit" },

  { id: "fx7", angleId: "a3", headline: "A gift they'll actually use", primary: "Give the bottle that goes everywhere. Easy returns for 30 days, in case it needs a swap.", cta: "Find a gift" },
  { id: "fx8", angleId: "a3", headline: "Skip the gift card", primary: "The Summit 750 is a gift that earns its spot in their bag every single day.", cta: "Shop gifts" },
  { id: "fx9", angleId: "a3", headline: "Gift something they'll love", primary: "Get 50% off bottles this holiday season. Grab one for everyone on your list.", cta: "Shop the sale" },

  { id: "fx10", angleId: "a4", headline: "20% off your first order", primary: "New here? Take 20% off your first order and free shipping over $50 on the Summit 750.", cta: "Claim 20% off" },
  { id: "fx11", angleId: "a4", headline: "Your first Summit costs less", primary: "Start with 20% off your first order. Free shipping over $50 and 30-day returns.", cta: "Get the offer" },
  { id: "fx12", angleId: "a4", headline: "20% off your first order", primary: "New here? Take 20% off your first order and free shipping over $50 on the Summit 750 today.", cta: "Claim your 20% off" },

  { id: "fx13", angleId: "a5", headline: "Made for the long way round", primary: "Clip it to your pack and go. The Summit 750 handles trail dust, rain and rough days.", cta: "Gear up" },
  { id: "fx14", angleId: "a5", headline: "Water that keeps up with you", primary: "From the first switchback to the summit, every sip stays cold. Keeps drinks cold 24 hours.", cta: "Shop the Summit" },
  { id: "fx15", angleId: "a5", headline: "Trail-tested, desk-approved", primary: "One bottle for the hike, the office and everything between. Free shipping over $50.", cta: "Shop now" },
];

// Cached replacements for "reject and regenerate" in cached mode.
// They do not use your reject reason. Live mode does.
export const FIXTURE_REGEN: Record<string, RawVariant[]> = {
  a1: [
    { id: "rg-a1-1", angleId: "a1", headline: "Cold when you open it", primary: "Open the Summit 750 after a long day and the water is still cold. Keeps drinks cold 24 hours.", cta: "Shop the Summit" },
    { id: "rg-a1-2", angleId: "a1", headline: "Cold, even in August", primary: "Leave it in the car, the bag or the sun. The Summit 750 keeps drinks cold 24 hours.", cta: "Shop now" },
  ],
  a2: [{ id: "rg-a2-1", angleId: "a2", headline: "One bottle. Years of refills.", primary: "Swap the single-use habit for a bottle built to be refilled every day.", cta: "Make the switch" }],
  a3: [{ id: "rg-a3-1", angleId: "a3", headline: "The gift that gets used daily", primary: "Not sure what to give? The Summit 750 fits every bag and every day. Returns are open for 30 days.", cta: "Find a gift" }],
  a4: [{ id: "rg-a4-1", angleId: "a4", headline: "Take 20% off your first Summit", primary: "Your first order gets 20% off, and shipping is free over $50. Returns are easy within 30 days.", cta: "Redeem 20% off" }],
  a5: [{ id: "rg-a5-1", angleId: "a5", headline: "Pack light, drink cold", primary: "The Summit 750 clips to your pack and keeps drinks cold 24 hours, from the trailhead to the top.", cta: "Gear up" }],
};