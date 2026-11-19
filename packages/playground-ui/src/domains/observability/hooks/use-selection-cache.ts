import { hashKey, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

/*
 * A rolling date preset ("Last 24 hours") is resolved against the clock when a page opens, so the
 * queries built from it ask with a new key on every visit and start with nothing cached:
 * `keepPreviousData` only carries data across key changes within one mounted query. These hooks
 * remember, per selection (what the user picked, without the clock), what earlier visits asked, so
 * a visit can reuse it. Both are kept per `QueryClient`, like the cache they point into.
 */

const keysBySelection = new WeakMap<QueryClient, Map<string, QueryKey[]>>();
const clocksBySelection = new WeakMap<QueryClient, Map<string, number>>();

function perClient<T>(store: WeakMap<QueryClient, Map<string, T>>, queryClient: QueryClient): Map<string, T> {
  let bySelection = store.get(queryClient);
  if (!bySelection) {
    bySelection = new Map();
    store.set(queryClient, bySelection);
  }
  return bySelection;
}

/**
 * `placeholderData` for a query whose key carries a rolling window: the newest cached result for
 * `selection` while the query's own first request runs, else the query's previous data, as
 * `keepPreviousData`. Coming back to a page then shows what it showed last instead of a skeleton,
 * and leaving out `selection` keeps plain `keepPreviousData`. It sends no request: the new key
 * fetches as it would without it.
 *
 * `selection` must name a single kind of query (its data is handed to `queryKey`'s query as is),
 * and `queryKey` must be the key the query runs under.
 */
export function useSelectionPlaceholder<TData>(selection: string | undefined, queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const queryHash = hashKey(queryKey);

  useEffect(() => {
    if (selection === undefined) return;
    const bySelection = perClient(keysBySelection, queryClient);
    // Forget keys the cache has garbage-collected, and move this one to the end (the newest).
    const kept = (bySelection.get(selection) ?? []).filter(
      key => hashKey(key) !== queryHash && queryClient.getQueryState(key) !== undefined,
    );
    bySelection.set(selection, [...kept, queryKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `queryHash` stands for `queryKey`, which is rebuilt every render.
  }, [queryClient, selection, queryHash]);

  return useCallback(
    (previous: TData | undefined): TData | undefined => {
      const keys = selection === undefined ? [] : (perClient(keysBySelection, queryClient).get(selection) ?? []);
      for (const key of keys.toReversed()) {
        const data = queryClient.getQueryData<TData>(key);
        if (data !== undefined) return data;
      }
      return previous;
    },
    [queryClient, selection],
  );
}

/**
 * The time to resolve `selection`'s rolling window against: the one an earlier visit used while
 * it is younger than `maxAgeMs`, else now. For a query that stays fresh for `maxAgeMs`, coming back
 * within that time asks the same question, which its cache answers without a request.
 */
export function useSelectionClock(selection: string, maxAgeMs: number): Date {
  const queryClient = useQueryClient();
  const clock = useMemo(() => {
    const now = Date.now();
    const last = perClient(clocksBySelection, queryClient).get(selection);
    return new Date(last !== undefined && now - last < maxAgeMs ? last : now);
  }, [queryClient, selection, maxAgeMs]);

  useEffect(() => {
    perClient(clocksBySelection, queryClient).set(selection, clock.getTime());
  }, [queryClient, selection, clock]);

  return clock;
}
