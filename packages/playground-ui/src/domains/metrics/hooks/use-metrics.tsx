/* eslint-disable react-refresh/only-export-components */
import { format } from 'date-fns';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { buildMetricsDimensionalFilter } from '../metrics-filters';
import type { MetricsDimensionalFilter } from '../metrics-filters';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';

const DATE_PRESETS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 3 days', value: '3d' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 14 days', value: '14d' },
  { label: 'Last 30 days', value: '30d' },
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number]['value'] | 'custom';

export { DATE_PRESETS };

const VALID_PRESETS = new Set<string>(DATE_PRESETS.map(p => p.value));

export function isValidPreset(value: string | null | undefined): value is DatePreset {
  return typeof value === 'string' && (VALID_PRESETS.has(value) || value === 'custom');
}

export type DateRange = { from?: Date; to?: Date };

/** Internal — all state is derived from the URL-backed props the owner passes.
 *  There is intentionally no local mirror; keeping a mirror caused URL ↔ state
 *  feedback loops that re-rendered the entire metrics tree on every keystroke.
 */
type MetricsContextValue = {
  datePreset: DatePreset;
  setDatePreset: (v: DatePreset) => void;
  customRange: DateRange | undefined;
  setCustomRange: (v: DateRange | undefined) => void;
  dateRangeLabel: string;
  filterTokens: PropertyFilterToken[];
  setFilterTokens: (tokens: PropertyFilterToken[]) => void;
  dimensionalFilter: MetricsDimensionalFilter;
  /** Stable JSON representation of `dimensionalFilter`, safe for query keys. */
  dimensionalFilterKey: string;
  /** Base path drilldown links should target for the Traces page. */
  tracesBasePath: string | undefined;
  /** Base path drilldown links should target for the Logs page. */
  logsBasePath: string | undefined;
};

export const MetricsContext = createContext<MetricsContextValue>({
  datePreset: '24h',
  setDatePreset: () => {},
  customRange: undefined,
  setCustomRange: () => {},
  dateRangeLabel: 'Last 24 hours',
  filterTokens: [],
  setFilterTokens: () => {},
  dimensionalFilter: {},
  dimensionalFilterKey: '{}',
  tracesBasePath: undefined,
  logsBasePath: undefined,
});

export function useMetrics() {
  return useContext(MetricsContext);
}

function getDateRangeLabel(preset: DatePreset, customRange: DateRange | undefined) {
  if (preset !== 'custom') {
    return DATE_PRESETS.find(p => p.value === preset)!.label;
  }
  if (customRange?.from) {
    if (customRange.to) {
      return `${format(customRange.from, 'MMM d, yyyy')} – ${format(customRange.to, 'MMM d, yyyy')}`;
    }
    return format(customRange.from, 'MMM d, yyyy');
  }
  return 'Custom range';
}

/**
 * URL-driven metrics provider.
 *
 * The owner (page) is expected to:
 *   - pass the current `preset` / `filterTokens` derived from `useSearchParams`
 *   - pass `onPresetChange` / `onFilterTokensChange` that update the URL
 *
 * The provider never stores its own copies — changes round-trip through the URL
 * exactly once, which keeps re-renders bounded no matter how much data is on
 * screen.
 */
export function MetricsProvider({
  children,
  preset,
  filterTokens,
  onPresetChange,
  onFilterTokensChange,
  customRange,
  onCustomRangeChange,
  tracesBasePath,
  logsBasePath,
}: {
  children: ReactNode;
  preset: DatePreset;
  filterTokens: PropertyFilterToken[];
  onPresetChange: (preset: DatePreset) => void;
  onFilterTokensChange: (tokens: PropertyFilterToken[]) => void;
  customRange?: DateRange;
  onCustomRangeChange?: (range: DateRange | undefined) => void;
  /** Base path for drilldown links to the Traces page. Defaults to `/observability` when omitted. */
  tracesBasePath?: string;
  /** Base path for drilldown links to the Logs page. Defaults to `/logs` when omitted. */
  logsBasePath?: string;
}) {
  // Stable key for memo dependencies — the parent may re-create the tokens
  // array on every render (e.g. from `useMemo(... , [searchParams])`), but the
  // *content* usually doesn't change.
  const filterTokensKey = useMemo(() => JSON.stringify(filterTokens), [filterTokens]);

  // Intentional: re-pin only when the serialized content changes, not on every
  // parent render that allocates a new array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFilterTokens = useMemo(() => filterTokens, [filterTokensKey]);

  const dimensionalFilter = useMemo(() => buildMetricsDimensionalFilter(stableFilterTokens), [stableFilterTokens]);

  const dimensionalFilterKey = useMemo(() => JSON.stringify(dimensionalFilter), [dimensionalFilter]);

  const dateRangeLabel = getDateRangeLabel(preset, customRange);

  const value = useMemo<MetricsContextValue>(
    () => ({
      datePreset: preset,
      setDatePreset: onPresetChange,
      customRange,
      setCustomRange: onCustomRangeChange ?? (() => {}),
      dateRangeLabel,
      filterTokens: stableFilterTokens,
      setFilterTokens: onFilterTokensChange,
      dimensionalFilter,
      dimensionalFilterKey,
      tracesBasePath,
      logsBasePath,
    }),
    [
      preset,
      onPresetChange,
      customRange,
      onCustomRangeChange,
      dateRangeLabel,
      stableFilterTokens,
      onFilterTokensChange,
      dimensionalFilter,
      dimensionalFilterKey,
      tracesBasePath,
      logsBasePath,
    ],
  );

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>;
}
