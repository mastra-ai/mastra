import { z } from 'zod/v4';
import {
  findPredicateComplexityIssue,
  TRACE_QUERY_MAX_PATH_BYTES,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TraceQueryValidationError,
  traceQueryPredicateSchema,
  traceQueryScalarPredicateSchema,
  traceQueryTimeRangeSchema,
} from './trace-query';
import type { TraceQueryIssue } from './trace-query';

/**
 * Public request/response contract for `aggregateTraces()`.
 *
 * Zod owns grammar and shape only (fixed literals, caps, defaults, unknown-property rejection).
 * Semantic checks — the groupable-dimension allowlist, `countDistinct` targets, `having` /
 * `orderBy` referencing declared measures, and the bucket cap — belong to the aggregate planner.
 */

export const TRACE_AGGREGATE_MAX_DIMENSIONS = 2;
export const TRACE_AGGREGATE_DEFAULT_LIMIT = 100;
export const TRACE_AGGREGATE_MAX_LIMIT = 1000;
export const TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS = 365;
export const TRACE_AGGREGATE_INTERVALS = ['1m', '5m', '15m', '1h', '1d'] as const;
export const TRACE_AGGREGATE_FIXED_MEASURES = [
  'count',
  'duration.avg',
  'duration.min',
  'duration.max',
  'duration.p50',
  'duration.p90',
  'duration.p95',
  'duration.p99',
  'errorCount',
  'errorRate',
] as const;
export const TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX = 'countDistinct.';

const hasMaxUtf8Bytes = (value: string, maxBytes: number) => Buffer.byteLength(value, 'utf8') <= maxBytes;

export function isTraceAggregateCountDistinctMeasure(name: string): boolean {
  return getTraceAggregateCountDistinctField(name) !== undefined;
}

/** Returns the target field of a `countDistinct.<field>` measure name, or `undefined` for any other name. */
export function getTraceAggregateCountDistinctField(name: string): string | undefined {
  if (!name.startsWith(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX)) return undefined;
  if (!hasMaxUtf8Bytes(name, TRACE_QUERY_MAX_PATH_BYTES)) return undefined;
  const field = name.slice(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX.length);
  return field.length > 0 ? field : undefined;
}

export const traceAggregateIntervalSchema = z.enum(TRACE_AGGREGATE_INTERVALS);

// templateLiteral keeps the `countDistinct.${string}` shape in the inferred type; the refine
// still enforces the non-empty field and the byte cap.
const traceAggregateCountDistinctMeasureSchema = z
  .templateLiteral([TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX, z.string()])
  .refine(name => isTraceAggregateCountDistinctMeasure(name), 'Invalid countDistinct measure');

export const traceAggregateMeasureSchema = z.union([
  z.enum(TRACE_AGGREGATE_FIXED_MEASURES),
  traceAggregateCountDistinctMeasureSchema,
]);

export const traceAggregateDimensionSchema = z
  .string()
  .min(1)
  .refine(value => hasMaxUtf8Bytes(value, TRACE_QUERY_MAX_PATH_BYTES), 'Dimension path is too large');

export const traceAggregateTimeRangeSchema = traceQueryTimeRangeSchema.superRefine((timeRange, context) => {
  const from = new Date(timeRange.from);
  const to = new Date(timeRange.to);
  if (from >= to) {
    context.addIssue({ code: 'custom', path: [], message: '`from` must be earlier than `to`' });
  } else if (to.getTime() - from.getTime() > TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    context.addIssue({
      code: 'custom',
      path: [],
      message: `The time range cannot exceed ${TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS} days`,
    });
  }
});

// The default orders by `count` even when `count` is not a requested measure; whether that is
// rejected or implicitly computed is the planner's decision.
export const traceAggregateOrderBySchema = z
  .object({
    field: z.string().min(1),
    direction: z.enum(['asc', 'desc']),
  })
  .strict()
  .default({ field: 'count', direction: 'desc' });

const hasDistinctValues = (values: readonly string[]) => new Set(values).size === values.length;

const traceAggregateRequestObjectSchema = z
  .object({
    timeRange: traceAggregateTimeRangeSchema,
    where: traceQueryPredicateSchema.optional(),
    groupBy: z
      .array(traceAggregateDimensionSchema)
      .max(TRACE_AGGREGATE_MAX_DIMENSIONS)
      .refine(hasDistinctValues, 'Dimensions must be distinct')
      .default([]),
    interval: traceAggregateIntervalSchema.optional(),
    measures: z.array(traceAggregateMeasureSchema).min(1).refine(hasDistinctValues, 'Measures must be distinct'),
    having: traceQueryScalarPredicateSchema.optional(),
    orderBy: traceAggregateOrderBySchema,
    limit: z.number().int().min(1).max(TRACE_AGGREGATE_MAX_LIMIT).default(TRACE_AGGREGATE_DEFAULT_LIMIT),
  })
  .strict();

export const traceAggregateRequestSchema = z.preprocess((input, context) => {
  const issuePath = findPredicateComplexityIssue(input, [['where'], ['having']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, traceAggregateRequestObjectSchema);

export const traceAggregateRowSchema = z
  .object({
    dimensions: z.record(z.string(), z.string().nullable()).optional(),
    bucket: z.string().datetime({ offset: true }).optional(),
    measures: z.record(traceAggregateMeasureSchema, z.number()),
  })
  .strict();

export const traceAggregateResponseSchema = z
  .object({
    rows: z.array(traceAggregateRowSchema),
    truncated: z.boolean(),
  })
  .strict();

export type TraceAggregateInterval = z.infer<typeof traceAggregateIntervalSchema>;
export type TraceAggregateMeasure = z.infer<typeof traceAggregateMeasureSchema>;
export type TraceAggregateRequest = z.input<typeof traceAggregateRequestObjectSchema>;
export type NormalizedTraceAggregateRequest = z.output<typeof traceAggregateRequestObjectSchema>;
export type TraceAggregateRow = z.infer<typeof traceAggregateRowSchema>;
export type TraceAggregateResponse = z.infer<typeof traceAggregateResponseSchema>;

function formatTraceAggregateSchemaIssues(error: z.ZodError): TraceQueryIssue[] {
  return error.issues.map(issue => {
    const predicateTooComplex = issue.code === 'custom' && issue.message === TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE;
    return {
      code: predicateTooComplex ? 'predicate_too_complex' : 'invalid_request',
      path: issue.path.map(part => (typeof part === 'symbol' ? String(part) : part)),
      message: predicateTooComplex
        ? TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE
        : 'The value does not match the trace-aggregate request contract',
    };
  });
}

export function parseTraceAggregateRequest(input: unknown): NormalizedTraceAggregateRequest {
  const result = traceAggregateRequestSchema.safeParse(input);
  if (!result.success) throw new TraceQueryValidationError(formatTraceAggregateSchemaIssues(result.error));
  return result.data;
}
