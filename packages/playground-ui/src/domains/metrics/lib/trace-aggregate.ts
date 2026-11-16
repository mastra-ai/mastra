/**
 * Builds `aggregateTraces()` requests from the Metrics page's filters, and lays their time series
 * on the same bucket grid as the other Metrics charts.
 */
import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
import type { TraceQueryPredicate, TraceQueryScalarPredicate } from '@mastra/core/storage';
import type { MetricsDimensionalFilter } from '@mastra/react/hooks/metrics';
import type { BucketLabels } from './metrics-buckets';
import { bucketGrid, bucketPlan, gridIndex, intervalHours } from './metrics-buckets';

export type TraceAggregateRow = AggregateTracesResponse['rows'][number];

/** Metrics filters that are trace fields of the same name. */
const TRACE_FIELDS = [
  'entityName',
  'environment',
  'threadId',
  'resourceId',
  'userId',
  'organizationId',
  'runId',
  'sessionId',
] as const satisfies readonly (keyof MetricsDimensionalFilter)[];

/** Metrics filters that match when any span of the trace has the value. */
const SPAN_FIELDS = ['provider', 'model'] as const satisfies readonly (keyof MetricsDimensionalFilter)[];

/** Metrics filters with no trace-query equivalent. Cards built on traces can't honor them. */
const UNSUPPORTED_FIELDS = [
  'serviceName',
  'requestId',
  'experimentId',
] as const satisfies readonly (keyof MetricsDimensionalFilter)[];

const eq = (path: string, literal: string): TraceQueryScalarPredicate => ({
  op: 'eq',
  left: { path },
  right: { literal },
});

export type TraceAggregateWhere =
  | { supported: true; where: TraceQueryPredicate | undefined }
  | { supported: false; unsupportedFields: string[] };

/**
 * The Metrics filter as a trace-query predicate. Every Metrics filter is an equality (tags: the
 * trace has every tag). Filters traces can't express are reported, so a card can say so instead of
 * showing numbers that ignore them.
 */
export function buildTraceAggregateWhere(filter: MetricsDimensionalFilter): TraceAggregateWhere {
  const unsupportedFields = UNSUPPORTED_FIELDS.filter(field => filter[field] !== undefined);
  if (unsupportedFields.length) return { supported: false, unsupportedFields };

  const args: TraceQueryPredicate[] = [];
  if (filter.rootEntityType) args.push(eq('entityType', filter.rootEntityType));
  for (const field of TRACE_FIELDS) {
    const value = filter[field];
    if (value !== undefined) args.push(eq(field, value));
  }
  for (const tag of filter.tags ?? []) args.push({ op: 'includes', path: 'tags', value: tag });
  for (const field of SPAN_FIELDS) {
    const value = filter[field];
    if (value !== undefined) args.push({ spans: { some: eq(field, value) } });
  }

  if (args.length === 0) return { supported: true, where: undefined };
  return { supported: true, where: args.length === 1 ? args[0] : { op: 'and', args } };
}

type Window = { start: Date; end: Date };

export const toTraceAggregateTimeRange = ({ start, end }: Window): AggregateTracesArgs['timeRange'] => ({
  from: start.toISOString(),
  to: end.toISOString(),
});

/**
 * The bucket size for a trace time series: the one the other Metrics charts ask for (1h up to two
 * weeks, then 1d). That keeps every window under the 1000-bucket cap, and a two-dimension series
 * under `limit × buckets ≤ 10 000`.
 */
export const traceAggregateInterval = ({ start, end }: Window) => bucketPlan(start, end).interval;

/**
 * `limit` for a grouped time series. The server caps `limit × buckets` at 10 000 and the default
 * limit is 100, which a two-week hourly series (337 buckets) would break. Ten groups fit the widest
 * window the server allows (366 daily buckets) and every chart here shows fewer series than that.
 */
export const TRACE_AGGREGATE_SERIES_LIMIT = 10;

export type TraceAggregateBucket = BucketLabels & { rows: TraceAggregateRow[] };

/**
 * Every bucket of the window with the rows the API returned for it, so quiet periods stay on the
 * axis. Buckets aren't merged: percentiles, distinct counts and coverage can't be added up.
 */
export function bucketTraceAggregateRows(rows: TraceAggregateRow[], window: Window): TraceAggregateBucket[] {
  const stepHours = intervalHours(traceAggregateInterval(window));
  const buckets: TraceAggregateBucket[] = bucketGrid(window.start, window.end, stepHours).map(labels => ({
    ...labels,
    rows: [],
  }));
  const indexOf = gridIndex(buckets, stepHours);
  for (const row of rows) {
    if (!row.bucket) continue;
    buckets[indexOf({ timestamp: row.bucket, value: 0 }) ?? -1]?.rows.push(row);
  }
  return buckets;
}
