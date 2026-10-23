import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useTraceAggregate } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AggregatePriority } from '../lib/request-limiter';
import { buildTraceAggregateWhere, toTraceAggregateTimeRange, traceAggregateInterval } from '../lib/trace-aggregate';
import { useLimitedQueryFn } from './use-aggregate-limiter';
import { useMetricsFilters } from './use-metrics-filters';

/** What every card's request shares: the page's frozen window and filters. */
export type TraceAggregateScope = Pick<AggregateTracesArgs, 'timeRange' | 'where'> & {
  interval: NonNullable<AggregateTracesArgs['interval']>;
  window: { start: Date; end: Date };
};

export type TraceAggregateGate =
  /** Capabilities are still loading. */
  | { status: 'loading' }
  /** The server can't answer the card (an older server, or a missing capability): hide it. */
  | { status: 'unavailable' }
  /** A page filter has no trace equivalent, so the card's numbers would ignore it. */
  | { status: 'unsupported-filter'; unsupportedFields: string[] }
  | { status: 'ready'; scope: TraceAggregateScope };

/**
 * Whether a trace-aggregate card can render, and the request scope when it can. Cards grouping or
 * filtering on the root span's `spanType` also need `traceQueryRootSpanFields`.
 */
export function useTraceAggregateGate({ requiresRootSpanFields = false } = {}): TraceAggregateGate {
  const { data, isLoading } = useObservabilityCapabilities();
  const { timestamp, dimensionalFilter } = useMetricsFilters();

  if (isLoading) return { status: 'loading' };
  const capabilities = data?.capabilities;
  if (capabilities?.traceAggregate !== true) return { status: 'unavailable' };
  if (requiresRootSpanFields && capabilities.traceQueryRootSpanFields !== true) return { status: 'unavailable' };

  const where = buildTraceAggregateWhere(dimensionalFilter);
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

/**
 * `aggregateTraces()` for one card, queued by `priority` behind the page's three-request cap. The
 * request carries the frozen window, so it is also the cache key: cards sending the same request
 * share one, and its answer never goes stale: a card mounting later, or a tab opened again, reuses it.
 * Retries come from the client only. A request already sent runs to the end, even if its
 * card unmounts; a queued one nobody observes any more is skipped.
 */
export function useMetricsTraceAggregate(
  request: AggregateTracesArgs,
  { priority }: { priority?: AggregatePriority } = {},
): UseQueryResult<AggregateTracesResponse> {
  const client = useMastraClient();
  const queryFn = useLimitedQueryFn(() => client.aggregateTraces(request), priority);
  return useTraceAggregate({
    request,
    queryOptions: { queryFn, placeholderData: keepPreviousData, staleTime: Infinity },
  });
}
