import { z } from "zod";
import { analysisRequestFields, analysisRequestSchema, dateRangeSchema } from "../source.ts";
import type { SourceCapability } from "../source.ts";
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
/** Sales filters are closed contracts; values are never coerced into SQL parameters. */
const salesFilterFields = z.strictObject({
  ownerId: z
    .number()
    .int({ error: "Owner ID must be a positive integer." })
    .positive({ error: "Owner ID must be a positive integer." })
    .optional(),
  segment: z.enum(["SMB", "Mid-market", "Enterprise"], { error: "Unknown segment." }).optional(),
  region: z.enum(["Americas", "EMEA", "APAC"], { error: "Unknown region." }).optional(),
  stage: z
    .enum(["qualification", "discovery", "proposal", "negotiation", "won", "lost"])
    .optional(),
});
export type Filters = {
  [Field in keyof z.infer<typeof salesFilterFields>]?: Exclude<
    z.infer<typeof salesFilterFields>[Field],
    undefined
  >;
};
export const salesFiltersSchema = salesFilterFields.transform(
  (filters): Filters =>
    Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined),
    ) as Filters,
);
export const monthlyPeriodSchema = dateRangeSchema.refine(
  (period) => period.start.endsWith("-01") && period.end.endsWith("-01"),
  "Monthly churn and customer cohorts require complete calendar months, with first-of-month bounds.",
);

/** Bind Sales inputs to advertised capabilities before opening the worker's database. */
export function salesRequestSchemaFor(capabilities: readonly SourceCapability[]) {
  const fields = z
    .strictObject({ ...analysisRequestFields, filters: salesFiltersSchema.optional() })
    .superRefine((request, context) => {
      const capability = capabilities.find((entry) => entry.metric === request.metric);
      if (!capability) {
        context.addIssue({
          code: "custom",
          path: ["metric"],
          message: "Unsupported Sales metric. Choose an advertised capability.",
        });
        return;
      }
      for (const field of Object.keys(request)) {
        if (field !== "metric" && !capability.fields.includes(field as never))
          context.addIssue({
            code: "custom",
            path: [field],
            message: `Unsupported fields for Sales metric '${request.metric}'.`,
          });
      }
      for (const field of ["period", "asOf", "horizon"] as const) {
        if (capability.fields.includes(field) && request[field] === undefined)
          context.addIssue({
            code: "custom",
            path: [field],
            message: `${field} requires ${field === "asOf" ? "a UTC date" : "UTC start and exclusive end dates"}.`,
          });
      }
      if (
        request.groupBy &&
        !capability.groupings?.some((group) => group.field === request.groupBy)
      )
        context.addIssue({
          code: "custom",
          path: ["groupBy"],
          message: "Choose an advertised Sales grouping.",
        });
      for (const field of Object.keys(request.filters ?? {})) {
        if (!capability.filters.includes(field))
          context.addIssue({
            code: "custom",
            path: ["filters", field],
            message: "Choose an advertised Sales filter.",
          });
      }
      const monthly =
        request.metric === "cohortRetention" ||
        request.metric === "cohortChurn" ||
        ((request.metric === "customerChurn" || request.metric === "revenueChurn") &&
          request.groupBy === "month");
      if (monthly && request.period) {
        const period = monthlyPeriodSchema.safeParse(request.period);
        if (!period.success)
          for (const issue of period.error.issues)
            context.addIssue({ ...issue, path: ["period", ...issue.path] });
      }
    });
  return analysisRequestSchema.transform((request, context) => {
    const parsed = fields.safeParse(request);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) context.addIssue({ ...issue });
      return z.NEVER;
    }
    return parsed.data;
  });
}
export type SalesRequest = z.infer<ReturnType<typeof salesRequestSchemaFor>>;
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
