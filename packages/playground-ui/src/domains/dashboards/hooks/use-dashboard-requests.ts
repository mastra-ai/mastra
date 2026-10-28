import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, useQueries, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useAggregateLimiter } from '../../metrics/hooks/use-aggregate-limiter';
import type { RequestLimiter } from '../../metrics/lib/request-limiter';
import type { DashboardRequest } from '../lib/requests';
import { requestKey, sendRequest } from '../lib/requests';

export type DashboardQueryResult = UseQueryResult;

function queryOptions(
  request: DashboardRequest,
  client: MastraClient,
  limiter: RequestLimiter,
  isObserved: (key: readonly unknown[]) => boolean,
) {
  const queryKey = requestKey(request);
  const isAggregate = request.method === 'aggregateTraces' || request.method === 'aggregateSpans';
  return {
    queryKey,
    // Grouped aggregates wait for a slot in the page's three-request cap, as the cards' do.
    queryFn: isAggregate
      ? () =>
          limiter.run(() => sendRequest(client, request), {
            priority: request.priority,
            isWanted: () => isObserved(queryKey),
          })
      : () => sendRequest(client, request),
    placeholderData: keepPreviousData,
    // The window is part of every request, so an answer never goes stale: a tab opened again reuses it.
    staleTime: Infinity,
    // Aggregates retry in the client only, as `useTraceAggregate` does.
    ...(isAggregate ? { retry: false, refetchOnWindowFocus: false } : {}),
  };
}

/**
 * Sends a view's requests; equal requests share one fetch across widgets. `undefined` entries keep
 * their slot without sending anything, so results line up with the view's queries.
 */
export function useDashboardRequests(requests: (DashboardRequest | undefined)[]): (DashboardQueryResult | undefined)[] {
  const client = useMastraClient();
  const limiter = useAggregateLimiter();
  const queryClient = useQueryClient();
  const isObserved = (key: readonly unknown[]) =>
    (queryClient.getQueryCache().find({ queryKey: key, exact: true })?.getObserversCount() ?? 0) > 0;
  const sent = requests.filter(r => r !== undefined);
  const results = useQueries({
    queries: sent.map(request => queryOptions(request, client, limiter, isObserved)),
  });
  let next = 0;
  return requests.map(r => (r === undefined ? undefined : results[next++]));
}
