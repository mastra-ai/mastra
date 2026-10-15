import type { QueryTracesInput } from '@mastra/client-js';
import { useTraceAggregate } from '@mastra/react/hooks/traces';
import { useState } from 'react';
import {
  TRACE_GROUP_SORT_PARAM,
  applyTraceGroupDrillDown,
  buildTraceGroupByRequest,
  DEFAULT_TRACE_GROUP_SORT,
  parseTraceGroupBy,
  parseTraceGroupHaving,
  parseTraceGroupSort,
  serializeTraceGroupSort,
  writeTraceGrouping,
} from '../trace-group-by';
import type { TraceGroupByDimension, TraceGroupFilter, TraceGroupSort, TraceGrouping } from '../trace-group-by';
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

const isSameDimensions = (a: readonly TraceGroupByDimension[], b: readonly TraceGroupByDimension[]) =>
  a.length === b.length && a.every((dimension, index) => dimension === b[index]);

/**
 * URL state and data for the Traces table's grouped view (`groupBy` / `groupHaving` / `groupSort`).
 *
 * The time window is fixed when the view opens and moves only when the grouping changes or on `refresh()`:
 * grouped requests over large tenants take seconds, so the view doesn't poll.
 */
export function useTraceGroupBy({ searchParams, setSearchParams, dimensions, query, enabled }: UseTraceGroupByArgs) {
  const groupBy = enabled ? parseTraceGroupBy(searchParams, dimensions) : [];
  const grouping: TraceGrouping = { groupBy, having: groupBy.length > 0 ? parseTraceGroupHaving(searchParams) : [] };
  const grouped = groupBy.length > 0;
  const sort = parseTraceGroupSort(searchParams);
  const [now, setNow] = useState(() => new Date());

  const result = useTraceAggregate({
    request: buildTraceGroupByRequest(query(now), grouping, sort),
    enabled: grouped,
    queryOptions: {
      // Keep the previous rows while the sort or filters change, but not across dimensions: their rows
      // would show under the new dimensions' headers.
      placeholderData: previous =>
        previous?.rows.some(row => groupBy.every(dimension => row.dimensions && dimension in row.dimensions))
          ? previous
          : undefined,
    },
  });

  /**
   * Change the grouped view. `writeOther` adds the page's own URL changes (e.g. its filters) to the same update,
   * so the two don't race. A new set of dimensions starts from the current time and clears the trace selection.
   */
  function setGrouping(nextGrouping: TraceGrouping, writeOther?: (next: URLSearchParams) => void) {
    const dimensionsChanged = !isSameDimensions(nextGrouping.groupBy, groupBy);
    if (dimensionsChanged) setNow(new Date());
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        writeOther?.(next);
        writeTraceGrouping(next, nextGrouping);
        if (dimensionsChanged) clearSelectionParams(next);
        return next;
      },
      { replace: true },
    );
  }

  function setSort(nextSort: TraceGroupSort) {
    const isDefault =
      nextSort.measure === DEFAULT_TRACE_GROUP_SORT.measure &&
      nextSort.direction === DEFAULT_TRACE_GROUP_SORT.direction;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (isDefault) next.delete(TRACE_GROUP_SORT_PARAM);
        else next.set(TRACE_GROUP_SORT_PARAM, serializeTraceGroupSort(nextSort));
        return next;
      },
      { replace: true },
    );
  }

  /** Narrow the trace list to a group and leave the grouped view. Project drill-downs are the page's to navigate. */
  function applyFilterDrillDown(filters: readonly TraceGroupFilter[]) {
    setSearchParams(prev => applyTraceGroupDrillDown(prev, filters));
  }

  function refresh() {
    setNow(new Date());
  }

  return {
    grouping,
    grouped,
    sort,
    setGrouping,
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
