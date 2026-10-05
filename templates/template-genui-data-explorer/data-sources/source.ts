import { z } from "zod";

export type Scalar = string | number | boolean | null;
export type SourceSettings = Readonly<Record<string, Scalar>>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type SourceDescriptor = z.infer<typeof sourceDescriptorSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** Read-only analyses advertised by a source; no shared business metric is mandatory. */
export interface DataSource {
  describe(): SourceDescriptor;
  execute(request: AnalysisRequest, context?: SourceExecutionContext): Promise<AnalysisResult>;
  close(): void | Promise<void>;
}

export interface SourceRegistration {
  id: string;
  enabled?: boolean;
  open(settings: SourceSettings): DataSource | Promise<DataSource>;
}

export type SourceOperation = z.infer<typeof sourceOperationSchema>;
export interface SourceExecutionContext {
  signal: AbortSignal;
  deadline: number;
  maxRows: number;
  maxBytes: number;
  requestId: string;
  queryId: string;
  traceId: string;
  trackCleanup?: (cleanup: Promise<void>) => void;
}
export const failureCodes = [
  "unsupported",
  "invalid-input",
  "source-unavailable",
  "authentication",
  "rate-limit",
  "timeout",
  "cancelled",
  "invalid-result",
  "incomplete-result",
  "budget-exceeded",
  "provider-unavailable",
  "busy",
  "invalid-composition",
  "stale-revision",
  "persistence-failure",
  "recovery-required",
] as const;
export type FailureCode = (typeof failureCodes)[number];
export class SourceError extends Error {
  readonly code: FailureCode;
  readonly retryable: boolean;
  constructor(code: FailureCode, message: string, retryable = false) {
    super(message);
    this.name = "SourceError";
    this.code = code;
    this.retryable = retryable;
  }
}
const scalarSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid UTC calendar date.");
export const dateRangeSchema = z
  .strictObject({ start: dateSchema, end: dateSchema })
  .refine((value) => value.start < value.end, "Start must precede exclusive end.");
export const analysisRequestSchema = z.strictObject({
  metric: z.string().min(1).max(80),
  period: dateRangeSchema.optional(),
  baseline: dateRangeSchema.optional(),
  horizon: dateRangeSchema.optional(),
  asOf: dateSchema.optional(),
  filters: z.record(z.string().max(80), scalarSchema).optional(),
  groupBy: z.string().trim().min(1).max(80).optional(),
  records: z.boolean().optional(),
});
export const sourceCapabilitySchema = z
  .strictObject({
    metric: z.string().min(1),
    description: z.string().min(1),
    unit: z.string().min(1),
    calculation: z.enum(["total", "percentage"]),
    fields: z.array(
      z.enum(["period", "baseline", "horizon", "asOf", "filters", "groupBy", "records"]),
    ),
    filters: z.array(z.string()),
    groupings: z
      .array(
        z.strictObject({ field: z.string().min(1).max(80), kind: z.enum(["series", "ranked"]) }),
      )
      .max(30)
      .optional(),
  })
  .refine(
    (capability) => (capability.calculation === "percentage") === (capability.unit === "percent"),
    "Percentage calculations require percent units; totals use non-percent units.",
  )
  .refine(
    (capability) =>
      !capability.fields.includes("groupBy") ||
      (Boolean(capability.groupings?.length) &&
        new Set(capability.groupings?.map((group) => group.field)).size ===
          capability.groupings?.length),
    "Grouped capabilities require unique declared grouping fields and roles.",
  );
export type SourceCapability = z.infer<typeof sourceCapabilitySchema>;
export const sourceDescriptorSchema = z
  .strictObject({
    id: z.string().min(1),
    title: z.string().min(1),
    version: z.string().min(1),
    datasetVersion: z.string().min(1),
    metricVersion: z.string().min(1),
    coverage: dateRangeSchema.optional(),
    asOf: dateSchema.optional(),
    metadata: z.record(z.string(), scalarSchema),
    capabilities: z.array(sourceCapabilitySchema).min(1),
    examples: z.array(z.strictObject({ title: z.string(), request: analysisRequestSchema })),
  })
  .refine(
    (value) =>
      new Set(value.capabilities.map((item) => item.metric)).size === value.capabilities.length,
    "Capability metrics must be unique.",
  );
export const tableColumnSchema = z.strictObject({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  type: z.enum(["date", "category", "number", "id"]),
  unit: z.string().min(1).max(80).optional(),
});
export const resultTableSchema = z
  .strictObject({
    kind: z.enum(["series", "ranked", "records"]),
    columns: z.array(tableColumnSchema).min(1).max(50),
    grouping: z.string().min(1).max(80).optional(),
    rows: z.array(z.record(z.string(), scalarSchema)).max(1000),
    omitted: z.number().int().nonnegative(),
  })
  .superRefine((table, ctx) => {
    if (table.kind === "records" ? table.grouping !== undefined : !groupingColumn(table))
      ctx.addIssue({
        code: "custom",
        message:
          "Grouped tables need an explicit grouping key or one unambiguous date/category column; records have no grouping.",
      });
    const keys = table.columns.map((column) => column.key);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Table column keys must be unique." });
    for (const row of table.rows) {
      if (Object.keys(row).length !== keys.length || keys.some((key) => !(key in row)))
        ctx.addIssue({ code: "custom", message: "Table rows must match declared columns." });
      for (const column of table.columns) {
        const value = row[column.key];
        if (
          (column.type === "number" || column.type === "id") &&
          (typeof value !== "number" || !Number.isFinite(value))
        )
          ctx.addIssue({ code: "custom", message: "Numeric columns need numeric values." });
        if ((column.type === "date" || column.type === "category") && typeof value !== "string")
          ctx.addIssue({ code: "custom", message: "Category/date columns need strings." });
        if (
          column.type === "date" &&
          typeof value === "string" &&
          !dateSchema.safeParse(value).success
        )
          ctx.addIssue({ code: "custom", message: "Dates must be valid UTC dates." });
      }
    }
  });
export type ResultTable = z.infer<typeof resultTableSchema>;
/** One source-owned grouping binding drives chart axes and drill membership. */
export function groupingColumn(table: ResultTable) {
  if (table.kind === "records") return undefined;
  const columns = table.columns.filter(
    (column) => column.type === (table.kind === "series" ? "date" : "category"),
  );
  return table.grouping
    ? columns.find((column) => column.key === table.grouping)
    : columns.length === 1
      ? columns[0]
      : undefined;
}
const sourceOperationSchema = z.strictObject({
  kind: z.enum(["sql", "read"]),
  statement: z.string().min(1),
  parameters: z.array(scalarSchema),
});
export const analysisResultSchema = z
  .strictObject({
    metric: z.string().min(1),
    request: analysisRequestSchema,
    status: z.enum(["available", "unavailable"]),
    value: z.number().finite().nullable(),
    unit: z.string().min(1),
    numerator: z.number().finite().nullable(),
    denominator: z.number().finite().nullable(),
    reason: z.string().nullable(),
    period: dateRangeSchema.optional(),
    table: resultTableSchema.optional(),
    details: z
      .record(
        z.string(),
        z.union([
          scalarSchema,
          dateRangeSchema,
          z.record(z.string(), z.number().finite()),
          z.array(z.record(z.string(), scalarSchema)),
        ]),
      )
      .optional(),
    provenance: z.strictObject({
      sourceId: z.string().min(1),
      sourceVersion: z.string().min(1),
      datasetVersion: z.string().min(1),
      metricVersion: z.string().min(1),
      asOf: dateSchema.optional(),
      coverage: dateRangeSchema.optional(),
      complete: z.boolean(),
      operations: z.array(sourceOperationSchema),
    }),
  })
  .superRefine((value, context) => {
    if (
      value.denominator !== null &&
      (!Number.isSafeInteger(value.denominator) || value.denominator < 0)
    )
      context.addIssue({
        code: "custom",
        message: "Denominators must be nonnegative safe integers.",
      });
    if (value.numerator !== null && !Number.isSafeInteger(value.numerator))
      context.addIssue({ code: "custom", message: "Numerators must be safe integers." });
    if (value.unit === "USD cents" && value.value !== null && !Number.isSafeInteger(value.value))
      context.addIssue({ code: "custom", message: "Currency values must be safe integer cents." });
    if (value.status === "available" && !value.provenance.operations.length)
      context.addIssue({
        code: "custom",
        message: "Available facts require actual source operations.",
      });
    if (
      value.status === "available" &&
      (value.value === null ||
        value.numerator === null ||
        value.reason !== null ||
        value.denominator === 0)
    )
      context.addIssue({
        code: "custom",
        message: "Available values require valid calculation operands.",
      });
    if (value.status === "unavailable" && (value.value !== null || !value.reason))
      context.addIssue({
        code: "custom",
        message: "Unavailable values require a reason and no value.",
      });
  });

/** Bind calculation semantics to trusted server capabilities rather than result operands. */
export function resultSchemaFor(capability: SourceCapability) {
  return analysisResultSchema.superRefine((result, context) => {
    if (result.unit !== capability.unit)
      context.addIssue({
        code: "custom",
        message: "The result unit does not match the capability.",
      });
    if (capability.calculation === "total" && result.denominator !== null)
      context.addIssue({ code: "custom", message: "Totals cannot have a denominator." });
    if (result.status !== "available" || result.numerator === null || result.value === null) return;
    if (capability.calculation === "percentage" && result.denominator === null) {
      context.addIssue({ code: "custom", message: "Available percentages require a denominator." });
      return;
    }
    const expected =
      capability.calculation === "total"
        ? result.numerator
        : (result.numerator / result.denominator!) * 100;
    if (result.value !== expected)
      context.addIssue({
        code: "custom",
        message: "The result value failed its capability calculation.",
      });
  });
}

/** Details only permit record arrays at this level; count all collections together. */
export function resultRecordCount(result: AnalysisResult): number {
  return Object.values(result.details ?? {}).reduce<number>(
    (total, value) => total + (Array.isArray(value) ? value.length : 0),
    result.table?.rows.length ?? 0,
  );
}
