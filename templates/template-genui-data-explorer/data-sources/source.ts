import { z } from "zod";

export type Scalar = string | number | boolean | null;
export type SourceSettings = Readonly<Record<string, Scalar>>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type SourceDescriptor = z.infer<typeof sourceDescriptorSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** An unavailable period rate can still have independently available monthly observations. */
export function hasAvailableData(data: AnalysisResult, descriptor: SourceDescriptor) {
  return (
    data.status === "available" ||
    (descriptor.capabilities.find((capability) => capability.metric === data.metric)
      ?.groupedCalculation === "independent" &&
      data.denominator === 0 &&
      Boolean(data.table?.rows.length))
  );
}

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
export const scalarSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Use a valid UTC calendar date.");
export const dateRangeSchema = z
  .strictObject({ start: dateSchema, end: dateSchema })
  .refine((value) => value.start < value.end, "Start must precede exclusive end.");
export const analysisRequestFields = {
  metric: z.string().min(1).max(80),
  period: dateRangeSchema.optional(),
  baseline: dateRangeSchema.optional(),
  horizon: dateRangeSchema.optional(),
  asOf: dateSchema.optional(),
  filters: z.record(z.string().max(80), scalarSchema).optional(),
  groupBy: z.string().trim().min(1).max(80).optional(),
  records: z.boolean().optional(),
};
export const analysisRequestSchema = z
  .strictObject(analysisRequestFields)
  .refine(
    (request) => !(request.groupBy && request.records),
    "Choose grouped data or records for one request.",
  )
  .transform((request) => {
    // Provider compatibility converts optional nulls to enumerable undefined fields.
    // Omit only absent known fields after strict validation, before capability checks.
    return Object.fromEntries(
      Object.entries(request).filter(([, value]) => value !== undefined),
    ) as typeof request;
  });

/** Named filters are expressible in strict provider schemas; open-ended records are not. */
export function analysisToolSchema(descriptor: SourceDescriptor) {
  const filters = [...new Set(descriptor.capabilities.flatMap((entry) => entry.filters))];
  const supportedBy = (field: SourceDescriptor["capabilities"][number]["fields"][number]) =>
    descriptor.capabilities
      .filter((entry) => entry.fields.includes(field))
      .map((entry) => entry.metric)
      .join(", ");
  return z
    .strictObject({
      ...analysisRequestFields,
      metric: z.enum(descriptor.capabilities.map((entry) => entry.metric)),
      period: analysisRequestFields.period.describe(
        `Start-inclusive/end-exclusive range. Only for: ${supportedBy("period")}.`,
      ),
      baseline: analysisRequestFields.baseline.describe(
        `Explicit comparison range. Only for: ${supportedBy("baseline")}. Otherwise absent/null.`,
      ),
      horizon: analysisRequestFields.horizon.describe(
        `Forecast range. Only for: ${supportedBy("horizon")}. Otherwise absent/null.`,
      ),
      asOf: analysisRequestFields.asOf.describe(
        `Inclusive snapshot day. Only for: ${supportedBy("asOf")}. Not a general reference date; otherwise absent/null.`,
      ),
      filters: z
        .strictObject(Object.fromEntries(filters.map((field) => [field, scalarSchema.optional()])))
        .optional()
        .describe(
          "Only requested cohort filters. Leave unused filters absent/null; never replace filtering with grouping.",
        ),
      records: z
        .literal(true)
        .optional()
        .describe(
          "Use true only for underlying records and only if the metric advertises records; otherwise absent/null.",
        ),
    })
    .transform((request) =>
      analysisRequestSchema.parse({
        ...request,
        ...(request.filters
          ? {
              filters: Object.fromEntries(
                Object.entries(request.filters).filter(([, value]) => value !== undefined),
              ),
            }
          : {}),
      }),
    );
}
export const presentationSchema = z.strictObject({
  label: z.string().trim().min(1).max(100),
  scenario: z.boolean().optional(),
  note: z.string().trim().min(1).max(2000).optional(),
});
export const filterControlSchema = z
  .strictObject({
    field: z.string().min(1).max(80),
    label: z.string().min(1).max(100),
    type: z.enum(["string", "number", "boolean"]),
    options: z
      .array(z.strictObject({ label: z.string().min(1).max(100), value: scalarSchema }))
      .min(1)
      .max(100)
      .optional(),
  })
  .refine(
    (control) =>
      !control.options?.some(
        (option) => option.value !== null && typeof option.value !== control.type,
      ),
    "Filter options must match the declared type.",
  );
export type FilterControl = z.infer<typeof filterControlSchema>;
export const sourceCapabilitySchema = z
  .strictObject({
    metric: z.string().min(1),
    presentation: presentationSchema.optional(),
    filterControls: z.array(filterControlSchema).max(30).optional(),
    recordCount: z
      .strictObject({ field: z.string().min(1).max(80), equals: scalarSchema })
      .optional(),
    description: z.string().min(1),
    unit: z.string().min(1),
    calculation: z.enum(["total", "percentage"]),
    groupedCalculation: z.enum(["partition", "independent"]).optional(),
    fields: z.array(
      z.enum(["period", "baseline", "horizon", "asOf", "filters", "groupBy", "records"]),
    ),
    filters: z.array(z.string()),
    groupings: z
      .array(
        z.strictObject({
          field: z.string().min(1).max(80),
          kind: z.enum(["series", "ranked", "matrix"]),
          label: z.string().min(1).max(100).optional(),
          interval: z.enum(["day", "month"]).optional(),
          drillFilter: z.string().min(1).max(80).optional(),
          cohort: z.boolean().optional(),
        }),
      )
      .max(30)
      .optional(),
  })
  .refine((capability) => {
    const controls = capability.filterControls ?? [];
    return (
      new Set(controls.map((control) => control.field)).size === controls.length &&
      controls.every(
        (control) =>
          capability.fields.includes("filters") && capability.filters.includes(control.field),
      ) &&
      (capability.groupings ?? []).every(
        (group) => !group.drillFilter || capability.filters.includes(group.drillFilter),
      )
    );
  }, "Controls and drill filters must reference advertised filters without duplicates.")
  .refine(
    (capability) => (capability.calculation === "percentage") === (capability.unit === "percent"),
    "Percentage calculations require percent units; totals use non-percent units.",
  )
  .refine(
    (capability) =>
      capability.groupedCalculation !== "independent" || capability.calculation === "percentage",
    "Independent observations are supported only for percentage calculations.",
  )
  .refine(
    (capability) =>
      !capability.fields.includes("groupBy") ||
      (Boolean(capability.groupings?.length) &&
        new Set(capability.groupings?.map((group) => group.field)).size ===
          capability.groupings?.length),
    "Grouped capabilities require unique declared grouping fields and roles.",
  )
  .refine(
    (capability) =>
      !capability.groupings?.some((group) => group.cohort) ||
      (capability.calculation === "percentage" && capability.groupedCalculation === "independent"),
    "Cohort matrices require independent percentage observations.",
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
    instructions: z.string().min(1).max(6000).optional(),
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
export const matrixAxesSchema = z.strictObject({
  x: z.string().min(1).max(80),
  y: z.string().min(1).max(80),
  value: z.string().min(1).max(80),
});
export const resultTableSchema = z
  .strictObject({
    kind: z.enum(["series", "ranked", "records", "matrix"]),
    columns: z.array(tableColumnSchema).min(1).max(50),
    grouping: z.string().min(1).max(80).optional(),
    axes: matrixAxesSchema.optional(),
    interval: z.enum(["day", "month"]).optional(),
    cohort: z.boolean().optional(),
    rows: z.array(z.record(z.string(), scalarSchema)).max(1000),
    omitted: z.number().int().nonnegative(),
  })
  .superRefine((table, ctx) => {
    if (
      table.kind === "records" || table.kind === "matrix"
        ? table.grouping !== undefined
        : !groupingColumn(table)
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Grouped tables need an explicit grouping key or one unambiguous date/category column; records have no grouping.",
      });
    if (table.kind === "matrix") {
      const axes = table.axes;
      const x = table.columns.find((column) => column.key === axes?.x);
      const y = table.columns.find((column) => column.key === axes?.y);
      const value = table.columns.find((column) => column.key === axes?.value);
      if (
        !axes ||
        !x ||
        !y ||
        !value ||
        new Set([x.key, y.key, value.key]).size !== 3 ||
        (table.cohort && (x.type !== "number" || y.type !== "date")) ||
        value.type !== "number"
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Matrices require distinct coordinate axes and a numeric value axis; cohorts need age and date axes.",
        });
      if (axes) {
        const cells = new Set<string>();
        for (const row of table.rows) {
          const coordinate = JSON.stringify([row[axes.x], row[axes.y]]);
          if (
            cells.has(coordinate) ||
            (table.cohort && (!Number.isSafeInteger(row[axes.x]) || Number(row[axes.x]) < 0))
          )
            ctx.addIssue({
              code: "custom",
              message: "Matrix coordinates must be unique with nonnegative integer ages.",
            });
          cells.add(coordinate);
        }
      }
    } else if (table.axes)
      ctx.addIssue({ code: "custom", message: "Matrix axes are only supported for matrix data." });
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
  if (table.kind === "records" || table.kind === "matrix") return undefined;
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
    presentation: presentationSchema.optional(),
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
    const table = value.table;
    if (table?.kind === "matrix" && table.cohort && table.axes) {
      const period = value.period;
      const groups = new Map<string, { size: number; ages: Set<number>; final: number }>();
      let previous = "";
      let valid = Boolean(period?.start.endsWith("-01") && period.end.endsWith("-01"));
      for (const row of table.rows) {
        const cohort = row[table.axes.y];
        const age = row[table.axes.x];
        if (
          !period ||
          typeof cohort !== "string" ||
          typeof age !== "number" ||
          typeof row.numerator !== "number" ||
          typeof row.denominator !== "number"
        ) {
          valid = false;
          continue;
        }
        const months =
          (Number(period.end.slice(0, 4)) - Number(cohort.slice(0, 4))) * 12 +
          Number(period.end.slice(5, 7)) -
          Number(cohort.slice(5, 7));
        const key = `${cohort}:${String(age).padStart(6, "0")}`;
        const group = groups.get(cohort) ?? {
          size: row.denominator,
          ages: new Set<number>(),
          final: 0,
        };
        if (
          !cohort.endsWith("-01") ||
          cohort < period.start ||
          cohort >= period.end ||
          age >= months ||
          key <= previous ||
          !Number.isSafeInteger(row.numerator) ||
          !Number.isSafeInteger(row.denominator) ||
          row.denominator < 1 ||
          row.numerator < 0 ||
          row.numerator > row.denominator ||
          group.size !== row.denominator
        )
          valid = false;
        previous = key;
        group.ages.add(age);
        if (age === months - 1) group.final = row.numerator;
        groups.set(cohort, group);
      }
      let numerator = 0;
      let denominator = 0;
      for (const [cohort, group] of groups) {
        const months = period
          ? (Number(period.end.slice(0, 4)) - Number(cohort.slice(0, 4))) * 12 +
            Number(period.end.slice(5, 7)) -
            Number(cohort.slice(5, 7))
          : 0;
        if (group.ages.size !== months) valid = false;
        numerator += group.final;
        denominator += group.size;
      }
      if (!valid || numerator !== value.numerator || denominator !== value.denominator)
        context.addIssue({
          code: "custom",
          message:
            "Cohort matrices need complete ordered month observations, fixed populations and a reconciled period-end rate.",
        });
    }
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

/** Missing display metadata uses a text control; adapters still validate business rules. */
export function filterControl(capability: SourceCapability, field: string): FilterControl {
  return (
    capability.filterControls?.find((control) => control.field === field) ?? {
      field,
      label: field,
      type: "string",
    }
  );
}
export function validFilterValue(capability: SourceCapability, field: string, value: Scalar) {
  if (!capability.fields.includes("filters") || !capability.filters.includes(field)) return false;
  const control = capability.filterControls?.find((control) => control.field === field);
  if (!control) return true;
  if (control.options) return control.options.some((option) => option.value === value);
  return typeof value === control.type && (typeof value !== "number" || Number.isFinite(value));
}
export function drillGrouping(capability: SourceCapability | undefined, request: AnalysisRequest) {
  if (!capability?.fields.includes("records") || request.records) return undefined;
  const group = capability.groupings?.find((group) => group.field === request.groupBy);
  return group &&
    ((group.kind === "series" && group.interval && request.period) || group.drillFilter)
    ? group
    : undefined;
}
