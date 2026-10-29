import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { rangeBeforeZoom, rememberZoom } from '../lib/zoom-memory';
import type { ZoomMemory } from '../lib/zoom-memory';
import {
  OBSERVABILITY_LIST_DEFAULT_DATE_PRESET,
  readObservabilityListDates,
  readObservabilityListFilters,
  readObservabilityListSort,
  writeObservabilityListDates,
  writeObservabilityListFilters,
  writeObservabilityListSort,
} from '../observability-list-url-state';
import type { ObservabilityListDates } from '../observability-list-url-state';
import { recoveryRefetchInterval } from '@/domains/observability/list-polling';
import { resolveTracesDateWindow } from '@/domains/traces/components/traces-explorer/traces-explorer-actions';
import { resolveTraceQueryTimeRange } from '@/domains/traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterToken } from '@/domains/traces/trace-query-filters';
import type { TraceDatePreset } from '@/domains/traces/types';
import type { DataListSort } from '@/ds/components/DataList/data-list-sortable-top-cell';
import type { SetURLSearchParamsLike } from '@/lib/sort/use-url-sort';

/**
 * Like the traces list with delta polling: a timer or a window focus would reload every loaded page
 * and reset the cursor chain, so an observability list only reloads to recover from a transient failure.
 */
export const observabilityListQueryOptions = {
  refetchInterval: ({ state }: { state: { error: unknown } }) => recoveryRefetchInterval(state.error),
  refetchOnWindowFocus: false,
};

export type ObservabilityListUrlState = {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParamsLike;
};

/** The search params of `url`, or of an in-memory store when the host keeps no URL state. */
function useListSearchParams(url: ObservabilityListUrlState | undefined): ObservabilityListUrlState {
  const [localParams, setLocalParams] = useState(() => new URLSearchParams());
  if (url) return url;
  return {
    searchParams: localParams,
    setSearchParams: next => setLocalParams(prev => (typeof next === 'function' ? next(prev) : next)),
  };
}

/**
 * The time range, filter and sort state of a spans or threads list, kept in the host's URL (same
 * date, sort and group params as /traces) so it survives a reload and can be shared. Without `url`
 * the state lives in memory.
 */
export function useObservabilityListFilters(url?: ObservabilityListUrlState) {
  const { searchParams, setSearchParams } = useListSearchParams(url);

  // Decoded values keep their identity while unrelated params (e.g. the open row) change.
  const datesKey = JSON.stringify(readObservabilityListDates(searchParams));
  const filtersKey = JSON.stringify(readObservabilityListFilters(searchParams));
  const { datePreset, dateFrom, dateTo } = useMemo(
    () => readObservabilityListDates(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-read when the date params change
    [datesKey],
  );
  const { tokens, groups } = useMemo(
    () => readObservabilityListFilters(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-read when the filter params change
    [filtersKey],
  );
  const sort: DataListSort = readObservabilityListSort(searchParams);

  const fromMs = dateFrom?.getTime();
  const toMs = dateTo?.getTime();
  // Rolling presets are resolved against "now" only when the range changes, so the query key
  // (and the cursors issued for it) stays stable while the list scrolls.
  const timeRange = useMemo(() => {
    const window = resolveTracesDateWindow(
      datePreset,
      fromMs === undefined ? undefined : new Date(fromMs),
      toMs === undefined ? undefined : new Date(toMs),
    );
    return resolveTraceQueryTimeRange(window.dateFrom, window.dateTo, new Date());
  }, [datePreset, fromMs, toMs]);

  // react-router resolves even a functional update against the params of the last render, so writes
  // made in the same tick (zoom sets `custom` then the range; the picker reports the range after a
  // preset change) build on the pending params instead, like `useState` updaters would.
  const pending = useRef<URLSearchParams | null>(null);
  useLayoutEffect(() => {
    pending.current = null;
  }, [searchParams]);
  const update = (write: (next: URLSearchParams) => void) => {
    const base = pending.current ?? searchParams;
    const next = new URLSearchParams(base);
    write(next);
    if (next.toString() === base.toString()) return;
    pending.current = next;
    setSearchParams(next, { replace: true });
  };
  const updateDates = (change: (current: ObservabilityListDates) => ObservabilityListDates) =>
    update(next => writeObservabilityListDates(next, change(readObservabilityListDates(next))));

  // Switching to `custom` keeps the current dates so the picker opens on them; any other preset drops them.
  const onDatePresetChange = (preset: TraceDatePreset) =>
    updateDates(current => (preset === 'custom' ? { ...current, datePreset: preset } : { datePreset: preset }));
  // The picker can report a date right after switching away from `custom`; those are ignored.
  const onDateChange = (date: Date | undefined, end: 'from' | 'to') =>
    updateDates(current => {
      if (current.datePreset !== 'custom') return current;
      return end === 'from' ? { ...current, dateFrom: date } : { ...current, dateTo: date };
    });
  const onDateRangeChange = (from: Date | undefined, to: Date | undefined) =>
    updateDates(current => (current.datePreset === 'custom' ? { ...current, dateFrom: from, dateTo: to } : current));
  // Not URL state: a shared or reloaded link has no zoom to undo.
  const zoomMemory = useRef<ZoomMemory | undefined>(undefined);
  /** Narrows the range to a histogram selection, remembering the range to return to on reset. */
  const onZoom = (from: Date, to: Date) =>
    updateDates(current => {
      zoomMemory.current = rememberZoom(zoomMemory.current, current, from, to);
      return { datePreset: 'custom', dateFrom: from, dateTo: to };
    });
  /** Undoes the last histogram zoom, or switches to `defaultPreset` when there is none to undo. */
  const onDateReset = (defaultPreset: TraceDatePreset) =>
    updateDates(current => {
      const before = rangeBeforeZoom(zoomMemory.current, current);
      zoomMemory.current = undefined;
      return before ?? { datePreset: defaultPreset };
    });
  const onFiltersChange = (nextTokens: TraceFilterToken[], nextGroups: TraceFilterGroup[]) =>
    update(next => writeObservabilityListFilters(next, { tokens: nextTokens, groups: nextGroups }));
  const setSort = (direction: DataListSort) => update(next => writeObservabilityListSort(next, direction));

  const contentFiltersApplied = tokens.length > 0 || groups.length > 0;
  const filtersApplied = contentFiltersApplied || datePreset !== OBSERVABILITY_LIST_DEFAULT_DATE_PRESET;

  return {
    datePreset,
    dateFrom,
    dateTo,
    timeRange,
    /** The window ends at "now", so new rows can still land in it. */
    rolling: dateTo === undefined,
    tokens,
    groups,
    sort,
    setSort,
    onDatePresetChange,
    onDateChange,
    onDateRangeChange,
    onZoom,
    onDateReset,
    onFiltersChange,
    contentFiltersApplied,
    filtersApplied,
  };
}
