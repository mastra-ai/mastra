import type { ListScoresResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '../query/query-utils';
import type { MastraQueryOptions } from '../shared/query-options';

const TRACE_SPAN_SCORES_REFETCH_INTERVAL_MS = 15_000;

export function getTraceSpanScoresRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'scores') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return TRACE_SPAN_SCORES_REFETCH_INTERVAL_MS;
}

type useTraceSpanScoresProps<TData> = {
  traceId?: string;
  spanId?: string;
  page?: number;
  queryOptions?: MastraQueryOptions<ListScoresResponse, TData>;
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useTraceSpanScores = <TData = ListScoresResponse>({
  traceId = '',
  spanId = '',
  page,
  queryOptions,
}: useTraceSpanScoresProps<TData>): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery<ListScoresResponse, Error, TData>({
    queryKey: ['trace-span-scores', traceId, spanId, page],
    queryFn: () => client.listScoresBySpan({ traceId, spanId, page: page || 0, perPage: 10 }),
    refetchInterval: getTraceSpanScoresRefetchInterval,
    gcTime: 0,
    staleTime: 0,
    ...queryOptions,
  });
};
