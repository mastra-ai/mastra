import { isTraceQueryMetadataPath } from './trace-query';
import type { TraceQueryMetadataField } from './trace-query';

export const TRACE_AGGREGATE_MAX_DIMENSIONS = 2;
export const TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX = 'countDistinct.';

export interface TraceAggregateDimensionRule {
  valueKind: 'string';
}

const stringDimension = (): TraceAggregateDimensionRule => ({ valueKind: 'string' });

/**
 * Trace-scope groupable dimensions for `aggregateTraces()` (Aggregate Query API Decision 4).
 * Key order is the spec order and is the order discovery lists them in. Top-level
 * `metadata.<key>` paths are also groupable; see `isTraceAggregateDimension`.
 */
export const TRACE_AGGREGATE_DIMENSION_REGISTRY = {
  entityType: stringDimension(),
  entityName: stringDimension(),
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

export const TRACE_AGGREGATE_METADATA_DIMENSION_RULE: TraceAggregateDimensionRule = stringDimension();

/** Identity fields excluded from grouping (Decision 4): grouping by identity is not grouping. */
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

export type TraceAggregateMeasureKind = 'count' | 'duration' | 'error';
export type TraceAggregateMeasureStatistic = 'avg' | 'min' | 'max' | 'p50' | 'p90' | 'p95' | 'p99';
export type TraceAggregateMeasureUnit = 'count' | 'milliseconds' | 'ratio';

export interface TraceAggregateMeasureRule {
  kind: TraceAggregateMeasureKind;
  statistic?: TraceAggregateMeasureStatistic;
  unit: TraceAggregateMeasureUnit;
  /** Percentiles tolerate backend-native approximation; counts and rates never do (Decision 3). */
  approximate: boolean;
}

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

/**
 * v1 measures for `aggregateTraces()` (Aggregate Query API Decision 3), in spec order.
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
} as const satisfies Record<string, TraceAggregateMeasureRule>;

export type TraceAggregateCanonicalMeasure = keyof typeof TRACE_AGGREGATE_MEASURE_REGISTRY;
export type TraceAggregateCountDistinctMeasure = `countDistinct.${TraceAggregateCountDistinctField}`;
export type TraceAggregateMeasure = TraceAggregateCanonicalMeasure | TraceAggregateCountDistinctMeasure;

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
  if (name.startsWith(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX)) {
    const field = name.slice(TRACE_AGGREGATE_COUNT_DISTINCT_PREFIX.length);
    if (isTraceAggregateCountDistinctField(field)) return { type: 'countDistinct', field };
  }
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
