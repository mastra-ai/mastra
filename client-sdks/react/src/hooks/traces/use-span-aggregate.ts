import type { AggregateSpansArgs, AggregateSpansResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export interface UseSpanAggregateArgs<TData = AggregateSpansResponse> {
  request: AggregateSpansArgs;
  enabled?: boolean;
  queryOptions?: MastraQueryOptions<AggregateSpansResponse, TData>;
}

/**
 * Runs `aggregateSpans()` for `request`. Check `useSpanAggregateAvailable()` before enabling it.
 *
 * Like `useTraceAggregate()`, it doesn't poll or retry: the client already retries server errors,
 * and a rejected request (4xx) fails once.
 */
export function useSpanAggregate<TData = AggregateSpansResponse>({
  request,
  enabled = true,
  queryOptions,
}: UseSpanAggregateArgs<TData>): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['span-aggregate', request],
    queryFn: () => client.aggregateSpans(request),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
}
