import type { State } from "./types";

// Cells starting with = + - @ get a leading ' so spreadsheets never run them as formulas.
const cell = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export function approvedCsv(s: State): string {
  const angle = (id: string) => s.angles.find((a) => a.id === id)?.name ?? id;
  const approvedAt = (id: string) => s.audit.find((e) => e.variantId === id && e.action === "approved")?.at ?? "";
  const head = ["id", "angle", "headline", "primary_text", "cta", "version", "approved_at"];
  const rows = s.variants
    .filter((v) => v.status === "approved")
    .map((v) => [v.id, angle(v.angleId), v.headline, v.primary, v.cta, v.version, approvedAt(v.id)]);
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}