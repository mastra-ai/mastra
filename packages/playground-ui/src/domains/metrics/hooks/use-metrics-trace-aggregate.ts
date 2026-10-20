import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useObservabilityCapabilities } from '@mastra/react/hooks/capabilities';
import { useTraceAggregate } from '@mastra/react/hooks/traces';
import { keepPreviousData } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { buildTraceAggregateWhere, toTraceAggregateTimeRange, traceAggregateInterval } from '../lib/trace-aggregate';
import { useMetricsFilters } from './use-metrics-filters';
import { useTraceAggregateLimiter } from './use-trace-aggregate-limiter';

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
 * `aggregateTraces()` for one card, queued behind the page's three-request cap. The request carries
 * the frozen window, so it is also the cache key. Retries come from the client only. Unmounting
 * aborts the request, whether it is queued or already sent.
 */
export function useMetricsTraceAggregate(request: AggregateTracesArgs): UseQueryResult<AggregateTracesResponse> {
  const client = useMastraClient();
  const limiter = useTraceAggregateLimiter();
  return useTraceAggregate({
    request,
    queryOptions: {
      queryFn: ({ signal }) => limiter.run(() => client.aggregateTraces(request, { signal }), signal),
      placeholderData: keepPreviousData,
    },
  });
}
