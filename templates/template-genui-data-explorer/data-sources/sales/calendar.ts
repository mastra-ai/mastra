import type { DatasetMetadata, Period } from "./contracts.ts";

export function dateOnly(value: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error("Use a valid UTC date (YYYY-MM-DD).");
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
  dateOnly(period.start);
  dateOnly(period.end);
  if (period.start >= period.end)
    throw new Error("The period must have a start before its exclusive end.");
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
