import { MastraClientError } from '@mastra/client-js';
import { useTraceQuery } from '@mastra/react/hooks/traces';
import type { TraceQueryArgs, UseTraceQueryArgs } from '@mastra/react/hooks/traces';
import { useEffect, useMemo, useState } from 'react';
import { toTracesListViewTraces } from '../components/traces-list-view-adapter';

export const TRACES_LIST_REFETCH_INTERVAL_MS = 10_000;

/** The server refused the request (e.g. a time range over its cap); retrying cannot change that. */
export function isRejectedTraceListRequest(error: unknown): boolean {
  return error instanceof MastraClientError && error.status >= 400 && error.status < 500;
}

export function fixedWindowRefetchInterval(error: unknown): number | false {
  return isRejectedTraceListRequest(error) ? false : TRACES_LIST_REFETCH_INTERVAL_MS;
}

export interface UseTracesListSourceArgs {
  query: (now: Date) => TraceQueryArgs;
  orderBy?: TraceQueryArgs['orderBy'];
  rolling?: boolean;
  initialAutoRefetch?: boolean;
  withQueryTrace?: boolean;
  legacyFilters?: UseTraceQueryArgs['legacyFilters'];
  /** Rows per page; defaults to `TRACE_QUERY_PER_PAGE`. */
  limit?: number;
  enabled?: boolean;
}

export function useTracesListSource({
  query: buildQuery,
  orderBy,
  rolling = true,
  initialAutoRefetch = true,
  withQueryTrace,
  legacyFilters,
  limit,
  enabled,
}: UseTracesListSourceArgs) {
  const [now, setNow] = useState(() => new Date());
  const [autoRefetch, setAutoRefetch] = useState(initialAutoRefetch);
  // A fixed window polls in place. Transient failures keep polling (a blip must not silence the
  // list), but a request the server refuses ends it: each retry would only clear the error, flash
  // the placeholder list, and fail again.
  const refetchInterval =
    autoRefetch && !rolling
      ? (query: { state: { error: unknown } }) => fixedWindowRefetchInterval(query.state.error)
      : false;
  const result = useTraceQuery({
    queryOptions: {
      traceQuery: { refetchInterval, refetchOnWindowFocus: autoRefetch },
      legacy: { refetchInterval, refetchOnWindowFocus: autoRefetch },
    },
    query: orderBy ? { ...buildQuery(now), orderBy } : buildQuery(now),
    withQueryTrace,
    legacyFilters,
    limit,
    enabled,
  });

  // Moving the query key refreshes the cursor chain once, without a second polling request.
  useEffect(() => {
    if (!autoRefetch || !rolling || result.error) return;
    const timer = setInterval(() => setNow(new Date()), TRACES_LIST_REFETCH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefetch, rolling, result.error]);

  // A rolling tick moves the query key; keep the previous rows when the data is the same so
  // consumers keyed on `rows` don't re-render every tick.
  const rows = useMemo(() => toTracesListViewTraces(result.data ?? []), [result.data]);

  return {
    ...result,
    rows,
    autoRefetch,
    setAutoRefetch,
  };
}
