export type Brief = {
  brand: string;
  product: string;
  audience: string;
  tone: string;
  bannedWords: string[];
  allowedClaims: string[]; // the fact sheet: the only offers, numbers and guarantees allowed
};

export type Angle = { id: string; name: string; rationale: string };

export type RawVariant = { id?: string; angleId: string; headline: string; primary: string; cta: string };

export type CheckRule = "banned_words" | "length" | "claims" | "duplicate";
export type CheckResult = { rule: CheckRule; passed: boolean; note: string };

export const RULE_LABEL: Record<CheckRule, string> = {
  banned_words: "Banned words",
  length: "Length limits",
  claims: "Claims vs fact sheet",
  duplicate: "Duplicates",
};

export type Status = "failed_checks" | "pending" | "approved" | "rejected" | "edited";

export type Variant = {
  id: string;
  angleId: string;
  parentId?: string;
  headline: string;
  primary: string;
  cta: string;
  status: Status;
  checks: CheckResult[];
  blockedOnArrival: boolean;
  rejectReason?: string;
  version: number;
};

export type AuditAction = "generated" | "approved" | "rejected" | "edited" | "reopened" | "regenerated";
export type AuditEntry = { id: string; at: string; variantId?: string; action: AuditAction; detail?: string };

export type Source = "cached" | "live";

export type State = {
  brief: Brief;
  angles: Angle[];
  variants: Variant[];
  audit: AuditEntry[];
  source: Source;
  model?: string;
};