import type { AggregateSpansArgs, AggregateSpansResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useSpanAggregate } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AggregatePriority } from '../lib/request-limiter';
import { buildSpanAggregateWhere } from '../lib/span-aggregate';
import { toTraceAggregateTimeRange, traceAggregateInterval } from '../lib/trace-aggregate';
import { useLimitedQueryFn } from './use-aggregate-limiter';
import { useMetricsFilters } from './use-metrics-filters';

/** What every span card's request shares: the page's frozen window and filters. */
export type SpanAggregateScope = Pick<AggregateSpansArgs, 'timeRange' | 'where'> & {
  interval: NonNullable<AggregateSpansArgs['interval']>;
  window: { start: Date; end: Date };
};

export type SpanAggregateGate =
  | { status: 'loading' }
  /** The server can't answer the card: hide it. */
  | { status: 'unavailable' }
  /** A page filter has no span equivalent, so the card's numbers would ignore it. */
  | { status: 'unsupported-filter'; unsupportedFields: string[] }
  | { status: 'ready'; scope: SpanAggregateScope };

/** Whether a span-aggregate card can render, and the request scope when it can. */
export function useSpanAggregateGate(): SpanAggregateGate {
  const { data, isLoading } = useObservabilityCapabilities();
  const { timestamp, dimensionalFilter } = useMetricsFilters();

  if (isLoading) return { status: 'loading' };
  if (data?.capabilities.spanAggregate !== true) return { status: 'unavailable' };

  const where = buildSpanAggregateWhere(dimensionalFilter);
  if (!where.supported) return { status: 'unsupported-filter', unsupportedFields: where.unsupportedFields };

  return {
    status: 'ready',
    scope: {
      timeRange: toTraceAggregateTimeRange(timestamp),
      ...(where.where ? { where: where.where } : {}),
      interval: traceAggregateInterval(timestamp),
      window: timestamp,
    },
  };
}

/** `aggregateSpans()` for one card, through the same limiter and caching as `useMetricsTraceAggregate()`. */
export function useMetricsSpanAggregate(
  request: AggregateSpansArgs,
  { priority }: { priority?: AggregatePriority } = {},
): UseQueryResult<AggregateSpansResponse> {
  const client = useMastraClient();
  const queryFn = useLimitedQueryFn(() => client.aggregateSpans(request), priority);
  return useSpanAggregate({
    request,
    queryOptions: { queryFn, placeholderData: keepPreviousData, staleTime: Infinity },
  });
}
