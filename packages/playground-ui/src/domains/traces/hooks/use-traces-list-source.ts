import { useTraceQuery, useTraceQueryLatest } from '@mastra/react/hooks/traces';
import type { TraceQueryArgs, UseTraceQueryArgs } from '@mastra/react/hooks/traces';
import { useEffect, useMemo, useState } from 'react';
import { toTracesListViewTraces } from '../components/traces-list-view-adapter';
import {
  OBSERVABILITY_LIST_HORIZON_MS,
  OBSERVABILITY_LIST_POLL_INTERVAL_MS,
  OBSERVABILITY_LIST_REFETCH_INTERVAL_MS,
  fixedWindowRefetchInterval,
  recoveryRefetchInterval,
} from '@/domains/observability/list-polling';

/** Fixed clock for comparing selections: filter and date changes move the query, time passing does not. */
const SELECTION_CLOCK = new Date(0);

export interface UseTracesListSourceArgs {
  query: (now: Date) => TraceQueryArgs;
  orderBy?: TraceQueryArgs['orderBy'];
  rolling?: boolean;
  /** Poll for new traces and refetch on window focus. */
  autoRefetch?: boolean;
  withQueryTrace?: boolean;
  /** The server supports delta polling: auto-refresh merges new traces instead of reloading the pages. */
  withDeltaPolling?: boolean;
  legacyFilters?: UseTraceQueryArgs['legacyFilters'];
  /** Rows per page; defaults to `TRACE_QUERY_PER_PAGE`. */
  limit?: number;
  enabled?: boolean;
}

export function useTracesListSource({
  query: buildQuery,
  orderBy,
  rolling = true,
  autoRefetch = true,
  withQueryTrace,
  withDeltaPolling = false,
  legacyFilters,
  limit,
  enabled = true,
}: UseTracesListSourceArgs) {
  const [tickNow, setTickNow] = useState(() => new Date());
  const delta = withDeltaPolling && withQueryTrace !== false;
  // A fixed window polls in place. Transient failures keep polling (a blip must not silence the
  // list), but a request the server refuses ends it: each retry would only clear the error, flash
  // the placeholder list, and fail again. With delta polling the list stays put and only retries
  // a transient failure.
  const refetchInterval = !autoRefetch
    ? false
    : delta
      ? (query: { state: { error: unknown } }) => recoveryRefetchInterval(query.state.error)
      : !rolling
        ? (query: { state: { error: unknown } }) => fixedWindowRefetchInterval(query.state.error)
        : false;
  const refetchOnWindowFocus = autoRefetch && !delta;

  // Delta polls need the same time range every poll, so `now` only moves when the filters or dates
  // change: the new list and the new cursor start from the current time. Sorting is not part of the
  // selection and keeps the cursor.
  const selection = JSON.stringify(buildQuery(SELECTION_CLOCK));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `selection` is the trigger, not an input.
  const anchoredNow = useMemo(() => new Date(), [selection]);
  const now = delta ? anchoredNow : tickNow;

  const built = buildQuery(now);
  // Delta polls must keep the exact time range, so a rolling window reaches into the future
  // instead of moving its end every tick.
  const anchored =
    delta && rolling && built.timeRange
      ? {
          ...built,
          timeRange: { ...built.timeRange, to: new Date(now.getTime() + OBSERVABILITY_LIST_HORIZON_MS).toISOString() },
        }
      : built;
  const query = orderBy ? { ...anchored, orderBy } : anchored;

  const result = useTraceQuery({
    queryOptions: {
      traceQuery: { refetchInterval, refetchOnWindowFocus },
      legacy: { refetchInterval, refetchOnWindowFocus },
    },
    query,
    withQueryTrace,
    legacyFilters,
    limit,
    enabled,
  });

  useTraceQueryLatest({
    query,
    limit,
    enabled: enabled && delta && autoRefetch,
    refetchInterval: OBSERVABILITY_LIST_POLL_INTERVAL_MS,
    queryOptions: { refetchOnWindowFocus: autoRefetch },
  });

  // Moving the query key refreshes the cursor chain once, without a second polling request.
  useEffect(() => {
    if (delta || !autoRefetch || !rolling || result.error) return;
    const timer = setInterval(() => setTickNow(new Date()), OBSERVABILITY_LIST_REFETCH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [delta, autoRefetch, rolling, result.error]);

  // A rolling tick moves the query key; keep the previous rows when the data is the same so
  // consumers keyed on `rows` don't re-render every tick.
  const rows = useMemo(() => toTracesListViewTraces(result.data ?? []), [result.data]);

  return {
    ...result,
    rows,
    autoRefetch,
  };
}
