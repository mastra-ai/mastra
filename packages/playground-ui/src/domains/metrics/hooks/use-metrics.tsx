/* eslint-disable react-refresh/only-export-components */
import { useMetricsQueryFilters } from '@mastra/react/hooks/metrics';
import type { MetricsQueryFilters } from '@mastra/react/hooks/metrics';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { buildMetricsDimensionalFilter } from '../metrics-filters';
import type { MetricsDimensionalFilter } from '../metrics-filters';
import { AggregateLimiterProvider } from './aggregate-limiter-provider';
import type { PropertyFilterToken } from '@/ds/components/PropertyFilter/types';
import { formatShortDate } from '@/utils/date-format';

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

/**
 * What the page knows about projects. Pages that span several projects (an organization) pass
 * `projectLabel`; cards then add a Project dimension. Studio has no projects and passes nothing.
 */
export type MetricsScope = {
  /** Display name for a project id. Setting it turns on the Project dimension. */
  projectLabel?: (projectId: string) => string;
};

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
  comparisonLabel: string;
  filterTokens: PropertyFilterToken[];
  setFilterTokens: (tokens: PropertyFilterToken[]) => void;
  dimensionalFilter: MetricsDimensionalFilter;
  /** Stable JSON representation of `dimensionalFilter`, safe for query keys. */
  dimensionalFilterKey: string;
  /** The page's window and filters, frozen once per window change so every card sends the same keys. */
  queryFilters: MetricsQueryFilters | undefined;
  scope: MetricsScope;
};

export const MetricsContext = createContext<MetricsContextValue>({
  datePreset: '24h',
  setDatePreset: () => {},
  customRange: undefined,
  setCustomRange: () => {},
  dateRangeLabel: 'Last 24 hours',
  comparisonLabel: 'vs previous 24h',
  filterTokens: [],
  setFilterTokens: () => {},
  dimensionalFilter: {},
  dimensionalFilterKey: '{}',
  queryFilters: undefined,
  scope: {},
});

export function useMetrics() {
  return useContext(MetricsContext);
}

function getDateRangeLabel(preset: DatePreset, customRange: DateRange | undefined) {
  if (preset !== 'custom') {
    return DATE_PRESETS.find(p => p.value === preset)?.label ?? preset;
  }
  if (customRange?.from) {
    if (customRange.to) {
      return `${formatShortDate(customRange.from)} – ${formatShortDate(customRange.to)}`;
    }
    return formatShortDate(customRange.from) ?? '';
  }
  return 'Custom range';
}

const HOUR_MS = 60 * 60 * 1000;

function getComparisonLabel(preset: DatePreset, customRange: DateRange | undefined) {
  if (preset !== 'custom') return `vs previous ${preset}`;
  const to = customRange?.to?.getTime() ?? Date.now();
  const from = customRange?.from?.getTime() ?? to - 24 * HOUR_MS;
  const hours = Math.round((to - from) / HOUR_MS);
  return `vs previous ${hours > 24 && hours % 24 === 0 ? `${hours / 24}d` : `${hours}h`}`;
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
  scope,
}: {
  children: ReactNode;
  preset: DatePreset;
  filterTokens: PropertyFilterToken[];
  onPresetChange: (preset: DatePreset) => void;
  onFilterTokensChange: (tokens: PropertyFilterToken[]) => void;
  customRange?: DateRange;
  onCustomRangeChange?: (range: DateRange | undefined) => void;
  /** Keep it referentially stable; a new object re-renders every card. */
  scope?: MetricsScope;
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

  // One anchor for the whole page: cards computing their own "now" would send near-duplicate keys.
  const queryFilters = useMetricsQueryFilters({
    datePreset: preset,
    customRange,
    dimensionalFilter,
    dimensionalFilterKey,
  });
  const resolvedScope = useMemo(() => scope ?? {}, [scope]);

  const dateRangeLabel = getDateRangeLabel(preset, customRange);
  const comparisonLabel = getComparisonLabel(preset, customRange);

  const value = useMemo<MetricsContextValue>(
    () => ({
      datePreset: preset,
      setDatePreset: onPresetChange,
      customRange,
      setCustomRange: onCustomRangeChange ?? (() => {}),
      dateRangeLabel,
      comparisonLabel,
      filterTokens: stableFilterTokens,
      setFilterTokens: onFilterTokensChange,
      dimensionalFilter,
      dimensionalFilterKey,
      queryFilters,
      scope: resolvedScope,
    }),
    [
      preset,
      onPresetChange,
      customRange,
      onCustomRangeChange,
      dateRangeLabel,
      comparisonLabel,
      stableFilterTokens,
      onFilterTokensChange,
      dimensionalFilter,
      dimensionalFilterKey,
      queryFilters,
      resolvedScope,
    ],
  );

  return (
    <MetricsContext.Provider value={value}>
      <AggregateLimiterProvider>{children}</AggregateLimiterProvider>
    </MetricsContext.Provider>
  );
}
