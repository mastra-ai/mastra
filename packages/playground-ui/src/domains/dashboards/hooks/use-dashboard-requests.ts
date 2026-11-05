import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useAggregateLimiter } from '../../metrics/hooks/use-aggregate-limiter';
import type { RequestLimiter } from '../../metrics/lib/request-limiter';
import type { DashboardAnswer, DashboardRequest, DashboardResult } from '../lib/requests';
import { requestKey, sendRequest } from '../lib/requests';

export type DashboardQueryResult = UseQueryResult<DashboardAnswer>;

const KEPT = { staleTime: Infinity } as const;
/** Aggregates retry in the client only, as `useTraceAggregate` does. */
const CLIENT_RETRIES = { retry: false, refetchOnWindowFocus: false } as const;

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
    queryFn:
      isAggregate && !request.unsatisfiable
        ? () =>
            limiter.run(() => sendRequest(client, request), {
              priority: request.priority,
              isWanted: () => isObserved(queryKey),
            })
        : () => sendRequest(client, request),
    // React Query lays these over the client's defaults, so a key set to `undefined` would erase a
    // default: the overrides below are left out rather than set to `undefined`.
    // Grouped aggregates and usage breakdowns keep an answer for the frozen window, as the cards' do; the
    // other cards refetch a tab opened again, so these do too.
    ...(isAggregate || request.method === 'getMetricBreakdown' || request.unsatisfiable ? KEPT : {}),
    ...(isAggregate ? CLIENT_RETRIES : {}),
  };
}

/**
 * Sends a view's requests; equal requests share one fetch across widgets. Results line up with
 * `requests`: an `undefined` request keeps its slot without sending anything. A request whose key
 * changed has no answer until its own arrives, so a widget never shows one window's or filter's
 * figures under another: it loads instead, and dims only while refetching an answer it already has.
 */
export function useDashboardRequests(requests: (DashboardRequest | undefined)[]): (DashboardQueryResult | undefined)[] {
  const client = useMastraClient();
  const limiter = useAggregateLimiter();
  const queryClient = useQueryClient();
  const isObserved = (key: readonly unknown[]) =>
    (queryClient.getQueryCache().find({ queryKey: key, exact: true })?.getObserversCount() ?? 0) > 0;
  const sent = requests.filter(request => request !== undefined);
  const results = useQueries({
    queries: sent.map(request => queryOptions(request, client, limiter, isObserved)),
  });
  let next = 0;
  return requests.map(request => (request ? results[next++] : undefined));
}

/** A query result as the plain data `StatelessWidget` renders from. */
export function toDashboardResult(result: DashboardQueryResult): DashboardResult {
  const { data, isLoading, isRefetching, isError, error } = result;
  return { data, isLoading, isRefetching, isError, error: error ?? undefined };
}

/**
 * `useDashboardRequests` as plain results, with `retry` refetching the ones that failed. Results line
 * up with `requests`.
 */
export function useDashboardResults(requests: (DashboardRequest | undefined)[]) {
  const sent = useDashboardRequests(requests);
  return {
    results: sent.map(r => (r ? toDashboardResult(r) : undefined)),
    retry: () => sent.forEach(r => r?.isError && void r.refetch()),
  };
}
