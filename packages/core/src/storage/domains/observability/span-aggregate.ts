/**
 * Storage contract for `aggregateSpans()`: grouped measures over individual current spans.
 *
 * Shares the `aggregateTraces()` envelope (window, intervals, `having`, `orderBy`, `limit`,
 * response rows) and measures. Differs in scope: `where` is the direct span field policy of
 * `querySpans()` (`SPAN_QUERY_FIELD_REGISTRY`), dimensions are span fields, and usage is
 * attributed per span rather than per trace. Trace-level questions ("traces containing a failing
 * tool call") remain `aggregateTraces()` with `spans.some`.
 */
import { z } from 'zod/v4';
import {
  getTraceAggregateCountDistinctField,
  TRACE_AGGREGATE_DEFAULT_LIMIT,
  TRACE_AGGREGATE_MAX_DIMENSIONS,
  TRACE_AGGREGATE_MAX_LIMIT,
  traceAggregateDimensionSchema,
  traceAggregateIntervalSchema,
  traceAggregateMeasureSchema,
  traceAggregateOrderBySchema,
  traceAggregateResponseSchema,
  traceAggregateTimeRangeSchema,
} from './trace-aggregate';
import type { TraceAggregateInterval } from './trace-aggregate';
import { planAggregateGroups } from './trace-aggregate-planner';
import type {
  TrustedAggregateMeasure,
  TrustedTraceAggregateHavingPredicate,
  TrustedTraceAggregateOrderBy,
} from './trace-aggregate-planner';
import { isTraceAggregateCanonicalMeasure, TRACE_AGGREGATE_MEASURE_REGISTRY } from './trace-aggregate-registry';
import type {
  TraceAggregateCanonicalMeasure,
  TraceAggregateDimensionDescriptor,
  TraceAggregateDimensionRule,
  TraceAggregateMeasureDescriptor,
} from './trace-aggregate-registry';
import {
  findPredicateComplexityIssue,
  formatTraceQuerySchemaIssues,
  normalizeTraceQueryTenantScope,
  planSpanQuerySelectionPredicate,
  TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE,
  TraceQueryValidationError,
  traceQueryScalarPredicateSchema,
} from './trace-query';
import type {
  TraceQueryIssue,
  TraceQueryPlanOptions,
  TraceQueryTenantScope,
  TrustedTraceQueryScalarPredicate,
} from './trace-query';

const stringDimension = (): TraceAggregateDimensionRule => ({ valueKind: 'string' });

/**
 * Span-scope groupable dimensions for `aggregateSpans()`, in discovery order.
 *
 * The trace dimensions plus the span's own `name`/`spanType`, its `entityId`, and the parent and
 * root entity context. Not groupable: `metadata.<key>` (the span field policy has no metadata),
 * identity fields (`traceId`, `spanId`, `parentSpanId`, `runId`, `requestId`), and
 * `model`/`provider`, which live in span attributes and cost a full attribute read to group on
 * (OBS-693 tracks dedicated columns).
 */
export const SPAN_AGGREGATE_DIMENSION_REGISTRY = {
  name: stringDimension(),
  spanType: stringDimension(),
  entityType: stringDimension(),
  entityId: stringDimension(),
  entityName: stringDimension(),
  parentEntityType: stringDimension(),
  parentEntityName: stringDimension(),
  rootEntityType: stringDimension(),
  rootEntityName: stringDimension(),
  environment: stringDimension(),
  status: stringDimension(),
  serviceName: stringDimension(),
  executionSource: stringDimension(),
  threadId: stringDimension(),
  resourceId: stringDimension(),
  userId: stringDimension(),
  sessionId: stringDimension(),
  organizationId: stringDimension(),
  experimentId: stringDimension(),
} as const satisfies Record<string, TraceAggregateDimensionRule>;

export type SpanAggregateDimension = keyof typeof SPAN_AGGREGATE_DIMENSION_REGISTRY;
export type SpanAggregateCountDistinctField = SpanAggregateDimension | 'traceId';

export function isSpanAggregateDimension(path: string): path is SpanAggregateDimension {
  return Object.hasOwn(SPAN_AGGREGATE_DIMENSION_REGISTRY, path);
}

export function isSpanAggregateCountDistinctField(path: string): path is SpanAggregateCountDistinctField {
  return path === 'traceId' || isSpanAggregateDimension(path);
}

export type ParsedSpanAggregateMeasure =
  | { type: 'canonical'; measure: TraceAggregateCanonicalMeasure }
  | { type: 'countDistinct'; field: SpanAggregateCountDistinctField };

/** Span aggregates use the trace measure registry; `countDistinct` targets are span dimensions or `traceId`. */
export function parseSpanAggregateMeasure(name: string): ParsedSpanAggregateMeasure | undefined {
  if (isTraceAggregateCanonicalMeasure(name)) return { type: 'canonical', measure: name };
  const field = getTraceAggregateCountDistinctField(name);
  if (field !== undefined && isSpanAggregateCountDistinctField(field)) return { type: 'countDistinct', field };
  return undefined;
}

export function getSpanAggregateDimensionDescriptors(): Array<
  Omit<TraceAggregateDimensionDescriptor, 'path'> & { path: SpanAggregateDimension }
> {
  return (Object.keys(SPAN_AGGREGATE_DIMENSION_REGISTRY) as SpanAggregateDimension[]).map(path => ({
    path,
    valueKind: SPAN_AGGREGATE_DIMENSION_REGISTRY[path].valueKind,
  }));
}

export function getSpanAggregateMeasureDescriptors(): TraceAggregateMeasureDescriptor[] {
  return (Object.keys(TRACE_AGGREGATE_MEASURE_REGISTRY) as TraceAggregateCanonicalMeasure[]).map(name => {
    const rule = TRACE_AGGREGATE_MEASURE_REGISTRY[name];
    return {
      name,
      kind: rule.kind,
      ...(rule.statistic ? { statistic: rule.statistic } : {}),
      unit: rule.unit,
      approximate: rule.approximate,
    };
  });
}

const hasDistinctValues = (values: readonly string[]) => new Set(values).size === values.length;

const spanAggregateRequestObjectSchema = z
  .object({
    timeRange: traceAggregateTimeRangeSchema,
    where: traceQueryScalarPredicateSchema.optional(),
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

/**
 * A span aggregate request without its time range, for callers that store a query and supply the
 * range at run time (dashboard widgets). Apply `findPredicateComplexityIssue` before parsing.
 */
export const spanAggregateQueryObjectSchema = spanAggregateRequestObjectSchema.omit({ timeRange: true });

export const spanAggregateRequestSchema = z.preprocess((input, context) => {
  const issuePath = findPredicateComplexityIssue(input, [['where'], ['having']]);
  if (issuePath) {
    context.addIssue({ code: 'custom', path: issuePath, message: TRACE_QUERY_PREDICATE_COMPLEXITY_MESSAGE });
    return z.NEVER;
  }
  return input;
}, spanAggregateRequestObjectSchema);

/** Same row shape as trace aggregates; `cost.coverage` is per usage-bearing span. */
export const spanAggregateResponseSchema = traceAggregateResponseSchema;

export type SpanAggregateRequest = z.input<typeof spanAggregateRequestObjectSchema>;
export type NormalizedSpanAggregateRequest = z.output<typeof spanAggregateRequestObjectSchema>;
export type SpanAggregateResponse = z.infer<typeof spanAggregateResponseSchema>;

export function parseSpanAggregateRequest(input: unknown): NormalizedSpanAggregateRequest {
  const parsed = spanAggregateRequestSchema.safeParse(input);
  if (!parsed.success) throw new TraceQueryValidationError(formatTraceQuerySchemaIssues(parsed.error));
  return parsed.data;
}

export type TrustedSpanAggregateMeasure = TrustedAggregateMeasure<SpanAggregateCountDistinctField>;
export type TrustedSpanAggregateMeasureName = TrustedSpanAggregateMeasure['name'];
export type TrustedSpanAggregateHavingPredicate = TrustedTraceAggregateHavingPredicate<TrustedSpanAggregateMeasureName>;
export type TrustedSpanAggregateOrderBy = TrustedTraceAggregateOrderBy<
  TrustedSpanAggregateMeasureName,
  SpanAggregateDimension
>;

/**
 * Trusted, backend-independent plan for `aggregateSpans()`.
 *
 * Group semantics (groups, `having`/`orderBy` over whole-window measures, null ordering, empty
 * populations, `limit`/`truncated`, buckets, caps enforced only by the planner, null measures) are
 * exactly those of `TrustedTraceAggregatePlan`. What differs:
 *
 * - **Window.** Up to `TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS`, as for traces. Hosts accept the
 *   span retention window they advertise, the same for every tenant scope (project or org), and
 *   stores must serve that whole window: there is no narrower org-wide span window.
 * - **Population.** One row per current completed span: exactly the spans `querySpans()` pages
 *   through for the same `timeRange`, `where`, and `scope`, so `count` with no `groupBy` equals
 *   that row count. Retry copies of a span collapse to its current copy before `where`,
 *   grouping, and measures. `where` uses the `querySpans()` field policy. Buckets use the span's
 *   `startedAt`; `duration.*` is the span's `endedAt - startedAt`; `errorCount`/`errorRate` read
 *   the span's own `error`.
 * - **Usage stage.** Usage is attributed per span, keyed by `(traceId, spanId)`, and aggregated per
 *   span before grouping. A metric row belongs to selected span S when its `traceId` and `spanId`
 *   are S's, its `name` is in `TRACE_AGGREGATE_USAGE_METRIC_NAMES`, its `timestamp >=
 *   timeRange.from` (no upper bound), and it matches `scope`. Rows sharing a `metricId` collapse
 *   to one, without relying on background merges. Usage is never rolled up to ancestor spans: a
 *   model call's tokens belong to the span that emitted them (normally `model_generation`, or the
 *   nearest exported span when model spans are hidden), so an `agent_run` span has no usage.
 * - **Tokens and cost.** The trace-aggregate rules with "trace" read as "span": a span is
 *   usage-bearing when at least one metric row belongs to it; `tokens.*.avg` divides by the
 *   group's usage-bearing spans, `cost.avg` by spans with a priced row, and `cost.coverage` is
 *   covered spans ÷ usage-bearing spans. Pricing (priced / failed to price / neither, `'mixed'`
 *   units) is the aggregate rule, not the per-span carrier rule `querySpans()` once used for its
 *   removed `cost` field; stores must not reuse that path.
 */
export interface TrustedSpanAggregatePlan {
  result: 'spanAggregate';
  timeRange: { from: string; to: string };
  where?: TrustedTraceQueryScalarPredicate;
  scope?: TraceQueryTenantScope;
  /** Normalized dimensions in request order (at most two). */
  dimensions: SpanAggregateDimension[];
  interval?: TraceAggregateInterval;
  /** Requested measures in request order; `countDistinct` names are normalized. */
  measures: TrustedSpanAggregateMeasure[];
  having?: TrustedSpanAggregateHavingPredicate;
  orderBy: TrustedSpanAggregateOrderBy;
  /** Maximum number of groups (not rows) in the response. */
  limit: number;
}

/**
 * Converts a span aggregate request into the canonical plan consumed by observability storage
 * adapters. Accepts raw input; schema and planner failures throw `TraceQueryValidationError`.
 *
 * @internal This is a trusted server/storage boundary, not a client-side query builder.
 */
export function planSpanAggregate(
  input: unknown,
  options: Pick<TraceQueryPlanOptions, 'scope'> = {},
): TrustedSpanAggregatePlan {
  const request = parseSpanAggregateRequest(input);
  const issues: TraceQueryIssue[] = [];
  const where = request.where ? planSpanQuerySelectionPredicate(request.where, issues) : undefined;
  const plan = planAggregateGroups(request, issues, {
    isDimension: isSpanAggregateDimension,
    parseMeasure: parseSpanAggregateMeasure,
  });
  return { result: 'spanAggregate', ...plan, where, scope: normalizeTraceQueryTenantScope(options.scope) };
}
