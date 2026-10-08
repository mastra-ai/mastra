import { SourceError, dateSchema, dateRangeSchema } from "../source.ts";
import type { DatasetMetadata, Period } from "./contracts.ts";

export function dateOnly(value: string): string {
  if (!dateSchema.safeParse(value).success)
    throw new SourceError("invalid-input", "Use a valid UTC date (YYYY-MM-DD).");
  return value;
}
export function shiftMonths(value: string, count: number): string {
  const date = new Date(dateOnly(value));
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function shiftDays(value: string, count: number): string {
  const date = new Date(dateOnly(value));
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function validatePeriod(period: Period): void {
  const parsed = dateRangeSchema.safeParse(period);
  if (!parsed.success)
    throw new SourceError("invalid-input", parsed.error.issues[0]?.message ?? "Invalid period.");
}
export function coverageReason(metadata: DatasetMetadata, period: Period): string | null {
  validatePeriod(period);
  return period.start < metadata.coverage.start || period.end > metadata.coverage.end
    ? `Insufficient history: available dates are [${metadata.coverage.start}, ${metadata.coverage.end}).`
    : null;
}
export function completeMonthCoverage(anchor: Date): Period {
  if (!Number.isFinite(anchor.getTime())) throw new Error("The dataset anchor is invalid.");
  const end = `${anchor.toISOString().slice(0, 7)}-01`;
  return { start: shiftMonths(end, -24), end };
}
export function samplePrompts(metadata: DatasetMetadata): string[] {
  const yearStart = shiftMonths(metadata.coverage.end, -12);
  return [
    `What were bookings from ${yearStart} to ${metadata.asOf}, compared with the matching previous year?`,
    `What was customer churn for the 12 months ending ${metadata.asOf}?`,
    `Show open pipeline as of ${metadata.asOf} by stage.`,
    `Show a weighted forecast scenario for the next three months as of ${metadata.asOf}.`,
  ];
}
