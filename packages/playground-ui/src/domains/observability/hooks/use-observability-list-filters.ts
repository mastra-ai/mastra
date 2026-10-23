import { useMemo, useState } from 'react';
import {
  DEFAULT_TRACES_FILTERS,
  resolveTracesDateWindow,
} from '@/domains/traces/components/traces-explorer/traces-explorer-actions';
import { recoveryRefetchInterval } from '@/domains/traces/hooks/use-traces-list-source';
import { resolveTraceQueryTimeRange } from '@/domains/traces/trace-query-filters';
import type { TraceFilterGroup, TraceFilterToken } from '@/domains/traces/trace-query-filters';
import type { TraceDatePreset } from '@/domains/traces/types';
import type { DataListSort } from '@/ds/components/DataList/data-list-sortable-top-cell';

// Same window as /traces, so switching between the pages keeps the time chip identical.
const DEFAULT_DATE_PRESET: TraceDatePreset = DEFAULT_TRACES_FILTERS.datePreset;

type DateState = { datePreset: TraceDatePreset; dateFrom?: Date; dateTo?: Date };

/**
 * Like the traces list with delta polling: a timer or a window focus would reload every loaded page
 * and reset the cursor chain, so an observability list only reloads to recover from a transient failure.
 */
export const observabilityListQueryOptions = {
  refetchInterval: ({ state }: { state: { error: unknown } }) => recoveryRefetchInterval(state.error),
  refetchOnWindowFocus: false,
};

/** The time range, filter and sort state of a spans or threads list. */
export function useObservabilityListFilters() {
  const [dates, setDates] = useState<DateState>({ datePreset: DEFAULT_DATE_PRESET });
  const [tokens, setTokens] = useState<TraceFilterToken[]>([]);
  const [groups, setGroups] = useState<TraceFilterGroup[]>([]);
  const [sort, setSort] = useState<DataListSort>('desc');

  const { datePreset, dateFrom, dateTo } = dates;
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

  // Switching to `custom` keeps the current dates so the picker opens on them; any other preset drops them.
  const onDatePresetChange = (preset: TraceDatePreset) =>
    setDates(current => (preset === 'custom' ? { ...current, datePreset: preset } : { datePreset: preset }));
  // The picker can report a date right after switching away from `custom`; those are ignored.
  const onDateChange = (date: Date | undefined, end: 'from' | 'to') =>
    setDates(current => {
      if (current.datePreset !== 'custom') return current;
      return end === 'from' ? { ...current, dateFrom: date } : { ...current, dateTo: date };
    });
  const onDateRangeChange = (from: Date | undefined, to: Date | undefined) =>
    setDates(current => (current.datePreset === 'custom' ? { ...current, dateFrom: from, dateTo: to } : current));
  const onFiltersChange = (nextTokens: TraceFilterToken[], nextGroups: TraceFilterGroup[]) => {
    setTokens(nextTokens);
    setGroups(nextGroups);
  };

  const contentFiltersApplied = tokens.length > 0 || groups.length > 0;
  const filtersApplied = contentFiltersApplied || datePreset !== DEFAULT_DATE_PRESET;

  return {
    datePreset,
    dateFrom,
    dateTo,
    timeRange,
    tokens,
    groups,
    sort,
    setSort,
    onDatePresetChange,
    onDateChange,
    onDateRangeChange,
    onFiltersChange,
    contentFiltersApplied,
    filtersApplied,
  };
}
