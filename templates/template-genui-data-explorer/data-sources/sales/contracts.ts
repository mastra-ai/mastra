import { SourceError } from "../source.ts";
export const VERSIONS = { schema: 1, generator: "sales-v1", metrics: "saas-v1" } as const;
export const STAGE_WEIGHTS = {
  qualification: 0.1,
  discovery: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
} as const;
export type OpenStage = keyof typeof STAGE_WEIGHTS;
export type Stage = OpenStage | "won" | "lost";
export interface Period {
  start: string;
  end: string;
}
export interface DatasetMetadata {
  schema: number;
  generator: string;
  metrics: string;
  seed: number;
  anchor: string;
  timezone: "UTC";
  currency: "USD";
  coverage: Period;
  asOf: string;
  complete: true;
}
export interface Filters {
  ownerId?: number;
  segment?: string;
  region?: string;
  stage?: Stage;
}
export function validateFilters(filters: Filters): void {
  const allowed = ["ownerId", "segment", "region", "stage"];
  if (Object.keys(filters).some((key) => !allowed.includes(key)))
    throw new SourceError("invalid-input", "Unknown Sales filter.");
  if (
    filters.ownerId !== undefined &&
    (!Number.isSafeInteger(filters.ownerId) || filters.ownerId < 1)
  )
    throw new SourceError("invalid-input", "Owner ID must be a positive integer.");
  if (
    filters.segment !== undefined &&
    !["SMB", "Mid-market", "Enterprise"].includes(filters.segment)
  )
    throw new SourceError("invalid-input", "Unknown segment.");
  if (filters.region !== undefined && !["Americas", "EMEA", "APAC"].includes(filters.region))
    throw new SourceError("invalid-input", "Unknown region.");
  if (
    filters.stage !== undefined &&
    ![...Object.keys(STAGE_WEIGHTS), "won", "lost"].includes(filters.stage)
  )
    throw new SourceError("invalid-input", "Unknown opportunity stage.");
}
export function safeInteger(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new Error("The analytical total exceeds the safe integer range.");
  return value;
}
export function resultInteger(value: unknown): number {
  if (typeof value === "bigint") {
    if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("The analytical total exceeds the safe integer range.");
    return Number(value);
  }
  if (typeof value !== "number") throw new Error("The source returned an invalid integer field.");
  return safeInteger(value);
}
export function resultText(value: unknown): string {
  if (typeof value !== "string") throw new Error("The source returned an invalid text field.");
  return value;
}
export function resultOpenStage(value: unknown): OpenStage {
  if (
    value !== "qualification" &&
    value !== "discovery" &&
    value !== "proposal" &&
    value !== "negotiation"
  )
    throw new Error("The source returned an invalid open stage.");
  return value;
}
export interface MetricResult {
  status: "available" | "unavailable";
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  unit: "USD cents" | "percent";
  reason: string | null;
  period: Period;
  coverage: Period;
  metricVersion: string;
}
export function metric(
  metadata: DatasetMetadata,
  period: Period,
  numerator: number | null,
  denominator: number | null = null,
  reason: string | null = null,
  unit: MetricResult["unit"] = denominator === null ? "USD cents" : "percent",
): MetricResult {
  if (numerator !== null) safeInteger(numerator);
  if (denominator !== null) safeInteger(denominator);
  if (numerator === null && reason === null)
    throw new Error("A missing metric requires an unavailable reason.");
  const unavailable = reason ?? (denominator === 0 ? "The denominator is zero." : null);
  let value: number | null = null;
  if (!unavailable) {
    if (numerator === null) throw new Error("A missing metric requires an unavailable reason.");
    value = denominator === null ? numerator : (numerator / denominator) * 100;
  }
  return {
    status: unavailable ? "unavailable" : "available",
    value,
    numerator,
    denominator,
    unit,
    reason: unavailable,
    period,
    coverage: metadata.coverage,
    metricVersion: metadata.metrics,
  };
}
