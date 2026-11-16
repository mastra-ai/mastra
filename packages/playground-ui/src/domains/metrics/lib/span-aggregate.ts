/**
 * Builds `aggregateSpans()` requests from the Metrics page's filters. Spans carry the correlation
 * fields themselves, so most filters apply directly; filters on trace tags or on model usage don't.
 */
import type { AggregateSpansArgs, AggregateSpansResponse } from '@mastra/client-js';
import type { MetricsDimensionalFilter } from '@mastra/react/hooks/metrics';

export type SpanAggregateRow = AggregateSpansResponse['rows'][number];
export type SpanAggregatePredicate = NonNullable<AggregateSpansArgs['where']>;

/** Metrics filters that are span fields of the same name. */
const SPAN_FIELDS = [
  'entityName',
  'environment',
  'serviceName',
  'threadId',
  'resourceId',
  'userId',
  'organizationId',
  'runId',
  'sessionId',
  'requestId',
  'experimentId',
] as const satisfies readonly (keyof MetricsDimensionalFilter)[];

/** Metrics filters with no span-query equivalent. */
const UNSUPPORTED_FIELDS = ['tags', 'provider', 'model'] as const satisfies readonly (keyof MetricsDimensionalFilter)[];

export const spanEq = (path: string, literal: string): SpanAggregatePredicate => ({
  op: 'eq',
  left: { path },
  right: { literal },
});

export type SpanAggregateWhere =
  | { supported: true; where: SpanAggregatePredicate | undefined }
  | { supported: false; unsupportedFields: string[] };

/**
 * The Metrics filter as a span predicate. The primitive type filter matches the span's own entity
 * type, as it does for metrics.
 */
export function buildSpanAggregateWhere(filter: MetricsDimensionalFilter): SpanAggregateWhere {
  const unsupportedFields = UNSUPPORTED_FIELDS.filter(field => filter[field] !== undefined);
  if (unsupportedFields.length) return { supported: false, unsupportedFields };

  const args: SpanAggregatePredicate[] = [];
  if (filter.rootEntityType) args.push(spanEq('entityType', filter.rootEntityType));
  for (const field of SPAN_FIELDS) {
    const value = filter[field];
    if (value !== undefined) args.push(spanEq(field, value));
  }

  if (args.length === 0) return { supported: true, where: undefined };
  return { supported: true, where: args.length === 1 ? args[0] : { op: 'and', args } };
}

/** `extra` and the page filter, both required. */
export function andSpanWhere(
  extra: SpanAggregatePredicate,
  where: SpanAggregatePredicate | undefined,
): SpanAggregatePredicate {
  return where ? { op: 'and', args: [extra, where] } : extra;
}
