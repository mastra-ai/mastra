import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export interface UseTraceAggregateArgs<TData = AggregateTracesResponse> {
  request: AggregateTracesArgs;
  enabled?: boolean;
  queryOptions?: MastraQueryOptions<AggregateTracesResponse, TData>;
}

/**
 * Runs `aggregateTraces()` for `request`. Check `useTraceAggregateAvailable()` before enabling it.
 *
 * It doesn't poll: grouped requests over large tenants take seconds, so it refetches only when the
 * request changes or the caller calls `refetch()`. The client already retries server errors, so
 * React Query doesn't retry on top of it, and a rejected request (4xx) fails once.
 */
export function useTraceAggregate<TData = AggregateTracesResponse>({
  request,
  enabled = true,
  queryOptions,
}: UseTraceAggregateArgs<TData>): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['trace-aggregate', request],
    queryFn: ({ signal }) => client.aggregateTraces(request, { signal }),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
}
