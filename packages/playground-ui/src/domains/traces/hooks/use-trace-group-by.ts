import type { QueryTracesInput } from '@mastra/client-js';
import { useTraceAggregate } from '@mastra/react/hooks/traces';
import { useCallback, useState } from 'react';
import {
  TRACE_GROUP_BY_PARAM,
  TRACE_GROUP_SORT_PARAM,
  applyTraceGroupDrillDown,
  buildTraceGroupByRequest,
  DEFAULT_TRACE_GROUP_SORT,
  parseTraceGroupBy,
  parseTraceGroupSort,
  serializeTraceGroupSort,
} from '../trace-group-by';
import type { TraceGroupByDimension, TraceGroupDrillDown, TraceGroupSort } from '../trace-group-by';
import { clearSelectionParams } from './use-trace-url-state';
import type { SetURLSearchParamsLike } from './use-trace-url-state';

export interface UseTraceGroupByArgs {
  searchParams: URLSearchParams;
  /** Route through the page's persisted setter so the grouped view is saved with the filters. */
  setSearchParams: SetURLSearchParamsLike;
  /** Dimensions the page offers, from `getOfferedTraceGroupByDimensions`. A `groupBy` outside them is ignored. */
  dimensions: readonly TraceGroupByDimension[];
  /** The trace list's selection, built for `now`. */
  query: (now: Date) => Pick<QueryTracesInput, 'timeRange' | 'where'>;
  /** False until `useTraceAggregateAvailable()` reports the server can group. */
  enabled: boolean;
}

/**
 * URL state and data for the Traces table's grouped view (`groupBy` / `groupSort`).
 *
 * The time window is fixed when the view opens and moves only on `refresh()`: grouped requests over
 * large tenants take seconds, so the view doesn't poll.
 */
export function useTraceGroupBy({ searchParams, setSearchParams, dimensions, query, enabled }: UseTraceGroupByArgs) {
  const groupBy = enabled ? parseTraceGroupBy(searchParams, dimensions) : undefined;
  const sort = parseTraceGroupSort(searchParams);
  const [now, setNow] = useState(() => new Date());

  const result = useTraceAggregate({
    request: buildTraceGroupByRequest(query(now), groupBy ?? 'entityName', sort),
    enabled: !!groupBy,
    queryOptions: {
      // Keep the previous rows while the sort or filters change, but not across dimensions: their rows
      // would show under the new dimension's header.
      placeholderData: previous =>
        groupBy && previous?.rows.some(row => row.dimensions && groupBy in row.dimensions) ? previous : undefined,
    },
  });

  const setGroupBy = useCallback(
    (dimension: TraceGroupByDimension | undefined) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (dimension) next.set(TRACE_GROUP_BY_PARAM, dimension);
          else next.delete(TRACE_GROUP_BY_PARAM);
          clearSelectionParams(next);
          return next;
        },
        { replace: true },
      );
      setNow(new Date());
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (nextSort: TraceGroupSort) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (
            nextSort.measure === DEFAULT_TRACE_GROUP_SORT.measure &&
            nextSort.direction === DEFAULT_TRACE_GROUP_SORT.direction
          ) {
            next.delete(TRACE_GROUP_SORT_PARAM);
          } else {
            next.set(TRACE_GROUP_SORT_PARAM, serializeTraceGroupSort(nextSort));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Narrow the trace list to a group and leave the grouped view. Project drill-downs are the page's to navigate. */
  const applyFilterDrillDown = useCallback(
    (drillDown: Extract<TraceGroupDrillDown, { kind: 'filter' }>) => {
      setSearchParams(prev => applyTraceGroupDrillDown(prev, drillDown));
    },
    [setSearchParams],
  );

  const refresh = useCallback(() => setNow(new Date()), []);

  return {
    groupBy,
    sort,
    setGroupBy,
    setSort,
    applyFilterDrillDown,
    refresh,
    rows: result.data?.rows ?? [],
    truncated: result.data?.truncated ?? false,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
  };
}
