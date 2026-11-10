import { TokenMetrics } from '../../../observability/types/metrics';
import { getTraceAggregateCountDistinctField } from './trace-aggregate';
import { isTraceQueryMetadataPath } from './trace-query';
import type { TraceQueryMetadataField } from './trace-query';

export interface TraceAggregateDimensionRule {
  valueKind: 'string';
}

const stringDimension = (): TraceAggregateDimensionRule => ({ valueKind: 'string' });

/**
 * Trace-scope groupable dimensions for `aggregateTraces()`.
 * Key order is the spec order and is the order discovery lists them in. Top-level
 * `metadata.<key>` paths are also groupable; see `isTraceAggregateDimension`.
 */
export const TRACE_AGGREGATE_DIMENSION_REGISTRY = {
  entityType: stringDimension(),
  entityName: stringDimension(),
  name: stringDimension(),
  spanType: stringDimension(),
  entityId: stringDimension(),
  environment: stringDimension(),
  status: stringDimension(),
  outcome: stringDimension(),
  stopReason: stringDimension(),
  serviceName: stringDimension(),
  executionSource: stringDimension(),
  threadId: stringDimension(),
  resourceId: stringDimension(),
  userId: stringDimension(),
  sessionId: stringDimension(),
  organizationId: stringDimension(),
  experimentId: stringDimension(),
} as const satisfies Record<string, TraceAggregateDimensionRule>;

export const TRACE_AGGREGATE_METADATA_DIMENSION_RULE: TraceAggregateDimensionRule = stringDimension();

/** Identity fields excluded from grouping: grouping by identity is not grouping. */
export const TRACE_AGGREGATE_IDENTITY_FIELDS = ['traceId', 'spanId', 'runId', 'requestId'] as const;

export type TraceAggregateCanonicalDimension = keyof typeof TRACE_AGGREGATE_DIMENSION_REGISTRY;
export type TraceAggregateDimension = TraceAggregateCanonicalDimension | TraceQueryMetadataField;
export type TraceAggregateCountDistinctField = TraceAggregateDimension | 'traceId';

export function isTraceAggregateCanonicalDimension(path: string): path is TraceAggregateCanonicalDimension {
  return Object.hasOwn(TRACE_AGGREGATE_DIMENSION_REGISTRY, path);
}

/**
 * Whether an already-normalized path may appear in `groupBy`. Callers unwrap
 * `${...}` templates and trim before calling; this predicate does no normalization.
 */
export function isTraceAggregateDimension(path: string): path is TraceAggregateDimension {
  return isTraceAggregateCanonicalDimension(path) || isTraceQueryMetadataPath(path);
}

export function isTraceAggregateCountDistinctField(path: string): path is TraceAggregateCountDistinctField {
  return path === 'traceId' || isTraceAggregateDimension(path);
}

export function getTraceAggregateDimensionRule(path: string): TraceAggregateDimensionRule | undefined {
  if (isTraceAggregateCanonicalDimension(path)) return TRACE_AGGREGATE_DIMENSION_REGISTRY[path];
  if (isTraceQueryMetadataPath(path)) return TRACE_AGGREGATE_METADATA_DIMENSION_RULE;
  return undefined;
}

export type TraceAggregateMeasureKind =
  | 'count'
  | 'duration'
  | 'error'
  | 'tokens'
  | 'cost'
  | 'timeToFirstToken'
  | 'timeToFirstChunk';
export type TraceAggregateMeasureStatistic = 'avg' | 'min' | 'max' | 'p50' | 'p90' | 'p95' | 'p99' | 'sum' | 'count';
export type TraceAggregateMeasureUnit = 'count' | 'milliseconds' | 'ratio' | 'tokens' | 'currency';

export interface TraceAggregateMeasureRule {
  kind: TraceAggregateMeasureKind;
  statistic?: TraceAggregateMeasureStatistic;
  unit: TraceAggregateMeasureUnit;
  /** Percentiles tolerate backend-native approximation; counts, sums, and rates never do. */
  approximate: boolean;
  /**
   * Token metric rows the measure is computed from. For `tokens.*` the per-trace
   * value is the sum of these rows' `value`; for `cost.*` it is the sum of their priced
   * `estimatedCost`. Absent for measures computed from the trace root.
   */
  metricNames?: readonly TokenMetrics[];
  /**
   * Nullable span column the measure reads, for `timeToFirstToken.*` and `timeToFirstChunk.*`.
   * Rows without a value are skipped, never read as 0; `.count` counts the rows that have one.
   */
  field?: TraceAggregateTimeToFirstField;
}

export type TraceAggregateTimeToFirstField = 'timeToFirstTokenMs' | 'timeToFirstChunkMs';

/**
 * Token metric rows that carry the per-call cost. Each total row already holds the sum of its
 * detail rows' costs, so cost is summed over these rows only.
 */
export const TRACE_AGGREGATE_COST_METRIC_NAMES = [TokenMetrics.TOTAL_INPUT, TokenMetrics.TOTAL_OUTPUT] as const;

/** Every token metric name a token or cost measure reads; store compilers prune metric rows to these. */
export const TRACE_AGGREGATE_USAGE_METRIC_NAMES = [
  TokenMetrics.TOTAL_INPUT,
  TokenMetrics.TOTAL_OUTPUT,
  TokenMetrics.OUTPUT_REASONING,
  TokenMetrics.INPUT_CACHE_READ,
] as const;

const countMeasure = (): TraceAggregateMeasureRule => ({ kind: 'count', unit: 'count', approximate: false });
const durationMeasure = (statistic: TraceAggregateMeasureStatistic): TraceAggregateMeasureRule => ({
  kind: 'duration',
  statistic,
  unit: 'milliseconds',
  approximate: statistic.startsWith('p'),
});
const errorMeasure = (unit: 'count' | 'ratio'): TraceAggregateMeasureRule => ({
  kind: 'error',
  unit,
  approximate: false,
});
const tokensMeasure = (statistic: 'sum' | 'avg', metricNames: readonly TokenMetrics[]): TraceAggregateMeasureRule => ({
  kind: 'tokens',
  statistic,
  unit: 'tokens',
  approximate: false,
  metricNames,
});
const costMeasure = (statistic: 'sum' | 'avg'): TraceAggregateMeasureRule => ({
  kind: 'cost',
  statistic,
  unit: 'currency',
  approximate: false,
  metricNames: TRACE_AGGREGATE_COST_METRIC_NAMES,
});

const timeToFirstMeasure = (
  kind: 'timeToFirstToken' | 'timeToFirstChunk',
  statistic: 'avg' | 'min' | 'max' | 'p50' | 'p90' | 'p95' | 'p99' | 'count',
): TraceAggregateMeasureRule => ({
  kind,
  statistic,
  unit: statistic === 'count' ? 'count' : 'milliseconds',
  approximate: statistic.startsWith('p'),
  field: kind === 'timeToFirstToken' ? 'timeToFirstTokenMs' : 'timeToFirstChunkMs',
});

const TOTAL_TOKEN_METRIC_NAMES = [TokenMetrics.TOTAL_INPUT, TokenMetrics.TOTAL_OUTPUT] as const;

/**
 * Measures for `aggregateTraces()`: the measures computed from the trace root, followed by the
 * token and cost measures, then time to first token/chunk. Time-to-first measures read the root
 * span's value in `aggregateTraces()` (the value `queryTraces()` returns) and each span's own value
 * in `aggregateSpans()`; they need the `aggregate-time-to-first-measures` store feature.
 * `countDistinct.<field>` is a family keyed by field and is handled by
 * `parseTraceAggregateMeasure` rather than listed here.
 */
export const TRACE_AGGREGATE_MEASURE_REGISTRY = {
  count: countMeasure(),
  'duration.avg': durationMeasure('avg'),
  'duration.min': durationMeasure('min'),
  'duration.max': durationMeasure('max'),
  'duration.p50': durationMeasure('p50'),
  'duration.p90': durationMeasure('p90'),
  'duration.p95': durationMeasure('p95'),
  'duration.p99': durationMeasure('p99'),
  errorCount: errorMeasure('count'),
  errorRate: errorMeasure('ratio'),
  'tokens.input.sum': tokensMeasure('sum', [TokenMetrics.TOTAL_INPUT]),
  'tokens.input.avg': tokensMeasure('avg', [TokenMetrics.TOTAL_INPUT]),
  'tokens.output.sum': tokensMeasure('sum', [TokenMetrics.TOTAL_OUTPUT]),
  'tokens.output.avg': tokensMeasure('avg', [TokenMetrics.TOTAL_OUTPUT]),
  'tokens.total.sum': tokensMeasure('sum', TOTAL_TOKEN_METRIC_NAMES),
  'tokens.total.avg': tokensMeasure('avg', TOTAL_TOKEN_METRIC_NAMES),
  'tokens.reasoning.sum': tokensMeasure('sum', [TokenMetrics.OUTPUT_REASONING]),
  'tokens.reasoning.avg': tokensMeasure('avg', [TokenMetrics.OUTPUT_REASONING]),
  'tokens.cached.sum': tokensMeasure('sum', [TokenMetrics.INPUT_CACHE_READ]),
  'tokens.cached.avg': tokensMeasure('avg', [TokenMetrics.INPUT_CACHE_READ]),
  'cost.sum': costMeasure('sum'),
  'cost.avg': costMeasure('avg'),
  'timeToFirstToken.avg': timeToFirstMeasure('timeToFirstToken', 'avg'),
  'timeToFirstToken.min': timeToFirstMeasure('timeToFirstToken', 'min'),
  'timeToFirstToken.max': timeToFirstMeasure('timeToFirstToken', 'max'),
  'timeToFirstToken.p50': timeToFirstMeasure('timeToFirstToken', 'p50'),
  'timeToFirstToken.p90': timeToFirstMeasure('timeToFirstToken', 'p90'),
  'timeToFirstToken.p95': timeToFirstMeasure('timeToFirstToken', 'p95'),
  'timeToFirstToken.p99': timeToFirstMeasure('timeToFirstToken', 'p99'),
  'timeToFirstToken.count': timeToFirstMeasure('timeToFirstToken', 'count'),
  'timeToFirstChunk.avg': timeToFirstMeasure('timeToFirstChunk', 'avg'),
  'timeToFirstChunk.min': timeToFirstMeasure('timeToFirstChunk', 'min'),
  'timeToFirstChunk.max': timeToFirstMeasure('timeToFirstChunk', 'max'),
  'timeToFirstChunk.p50': timeToFirstMeasure('timeToFirstChunk', 'p50'),
  'timeToFirstChunk.p90': timeToFirstMeasure('timeToFirstChunk', 'p90'),
  'timeToFirstChunk.p95': timeToFirstMeasure('timeToFirstChunk', 'p95'),
  'timeToFirstChunk.p99': timeToFirstMeasure('timeToFirstChunk', 'p99'),
  'timeToFirstChunk.count': timeToFirstMeasure('timeToFirstChunk', 'count'),
} as const satisfies Record<string, TraceAggregateMeasureRule>;

export type TraceAggregateCanonicalMeasure = keyof typeof TRACE_AGGREGATE_MEASURE_REGISTRY;
export type TraceAggregateCountDistinctMeasure = `countDistinct.${TraceAggregateCountDistinctField}`;

export type ParsedTraceAggregateMeasure =
  | { type: 'canonical'; measure: TraceAggregateCanonicalMeasure; rule: TraceAggregateMeasureRule }
  | { type: 'countDistinct'; field: TraceAggregateCountDistinctField };

export function isTraceAggregateCanonicalMeasure(name: string): name is TraceAggregateCanonicalMeasure {
  return Object.hasOwn(TRACE_AGGREGATE_MEASURE_REGISTRY, name);
}

export function parseTraceAggregateMeasure(name: string): ParsedTraceAggregateMeasure | undefined {
  if (isTraceAggregateCanonicalMeasure(name)) {
    return { type: 'canonical', measure: name, rule: TRACE_AGGREGATE_MEASURE_REGISTRY[name] };
  }
  const field = getTraceAggregateCountDistinctField(name);
  if (field !== undefined && isTraceAggregateCountDistinctField(field)) return { type: 'countDistinct', field };
  return undefined;
}

export interface TraceAggregateDimensionDescriptor {
  path: TraceAggregateCanonicalDimension;
  valueKind: TraceAggregateDimensionRule['valueKind'];
}

export interface TraceAggregateMeasureDescriptor {
  name: TraceAggregateCanonicalMeasure;
  kind: TraceAggregateMeasureKind;
  statistic?: TraceAggregateMeasureStatistic;
  unit: TraceAggregateMeasureUnit;
  approximate: boolean;
}

export function getTraceAggregateDimensionDescriptors(): TraceAggregateDimensionDescriptor[] {
  return (Object.keys(TRACE_AGGREGATE_DIMENSION_REGISTRY) as TraceAggregateCanonicalDimension[]).map(path => ({
    path,
    valueKind: TRACE_AGGREGATE_DIMENSION_REGISTRY[path].valueKind,
  }));
}

export function getTraceAggregateMeasureDescriptors(): TraceAggregateMeasureDescriptor[] {
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
