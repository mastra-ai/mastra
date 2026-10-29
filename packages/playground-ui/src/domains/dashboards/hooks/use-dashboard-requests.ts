import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useAggregateLimiter } from '../../metrics/hooks/use-aggregate-limiter';
import type { RequestLimiter } from '../../metrics/lib/request-limiter';
import type { DashboardAnswer, DashboardRequest } from '../lib/requests';
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
  held: DashboardAnswer | undefined,
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
    // `useQueries` matches queries by key, so a changed request loses `keepPreviousData`'s answer, unlike
    // the cards' `useQuery`: fall back to the slot's last settled answer, when it has the same shape.
    placeholderData: (previous: DashboardAnswer | undefined) =>
      previous ?? (held?.method === request.method ? held : undefined),
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
 * `requests`: an `undefined` request keeps its slot without sending anything.
 */
export function useDashboardRequests(requests: (DashboardRequest | undefined)[]): (DashboardQueryResult | undefined)[] {
  const client = useMastraClient();
  const limiter = useAggregateLimiter();
  const queryClient = useQueryClient();
  const [held, setHeld] = useState<(DashboardAnswer | undefined)[]>([]);
  const isObserved = (key: readonly unknown[]) =>
    (queryClient.getQueryCache().find({ queryKey: key, exact: true })?.getObserversCount() ?? 0) > 0;
  const slots = requests.flatMap((request, slot) => (request ? [{ request, slot }] : []));
  const results = useQueries({
    queries: slots.map(({ request, slot }) => queryOptions(request, client, limiter, isObserved, held[slot])),
  });
  const bySlot = requests.map((_, slot) => {
    const index = slots.findIndex(s => s.slot === slot);
    return index < 0 ? undefined : results[index];
  });

  // Remembers each slot's last settled answer once it changes, for the slot's next request to show.
  // Set while rendering, as React allows for state derived from what a render sees: React renders
  // again straight away, and stops once the answers stop changing.
  const settled = bySlot.map(result => (result && !result.isPlaceholderData ? result.data : undefined));
  const next = settled.map((answer, slot) => answer ?? held[slot]);
  if (next.length !== held.length || next.some((answer, slot) => answer !== held[slot])) setHeld(next);

  return bySlot;
}
