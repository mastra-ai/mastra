import type { ReactNode } from 'react';
import { TRACE_FILTER_BAR_OPERATORS } from '../../trace-filters';
import type { TraceDatePreset } from '../../types';
import { TRACE_TIME_RANGE_FIELD_ID, TraceTimeRangeChip } from '../trace-time-range-chip';
import type { TraceTimeRangeChipProps } from '../trace-time-range-chip';
import { unsupportedTraceFilterReason } from './traces-explorer-actions';
import { useTracesConfig, useTracesFilters, useTracesList } from './traces-explorer-context';
import { useTracesFilterBar, useTracesFilterBarFields } from './use-traces-filter-bar';
import { FilterBar } from '@/ds/components/FilterBar';
import type { FilterBarItem, FilterBarNode } from '@/ds/components/FilterBar';

const TIME_RANGE_PRESETS: readonly TraceDatePreset[] = [
  'last-24h',
  'last-3d',
  'last-7d',
  'last-14d',
  'last-30d',
  'custom',
];

// Items are rebuilt from tokens with `id: fieldId` (traceTokensToFilterBarItems); give the
// draft that id so the chip survives the round trip without remounting.
const createItemId = (fieldId: string) => fieldId;

export type TracesExplorerFilterBarProps = {
  /** Replaces the default chips and input, e.g. to pass a configured `TracesExplorer.TimeRangeChip`. */
  children?: ReactNode;
};

/**
 * The trace filters bar, wired to the explorer's fields and filters. Hosts that need extra
 * fields or items (e.g. their own scope pickers) can render the design-system `FilterBar`
 * themselves from `useTracesFilterBarFields()` / `useTracesFilterBar()` and reuse `FilterChips`.
 */
export function TracesExplorerFilterBar({ children }: TracesExplorerFilterBarProps) {
  const { withQueryTrace } = useTracesConfig();
  const filterBarFields = useTracesFilterBarFields();
  const { filterBarValue, onFilterBarChange } = useTracesFilterBar();

  return (
    <FilterBar
      fields={filterBarFields}
      operators={TRACE_FILTER_BAR_OPERATORS}
      value={filterBarValue}
      onValueChange={onFilterBarChange}
      createItemId={createItemId}
      // The list endpoint can't run AND/OR groups: none are offered, the ones held show muted.
      maxDepth={withQueryTrace ? 3 : 0}
      aria-label="Trace filters"
      className="min-w-64 flex-1"
    >
      {children ?? (
        <>
          <TracesExplorerFilterChips />
          <FilterBar.Input placeholder="Filter traces…" />
        </>
      )}
    </FilterBar>
  );
}

export type TracesExplorerFilterChipsProps = {
  /** Rendered for the time range item. Defaults to `<TracesExplorer.TimeRangeChip />`. */
  timeRange?: ReactNode;
  /** Renders every other item this server can run. Defaults to the design-system chip. */
  renderChip?: (item: FilterBarItem) => ReactNode;
};

/**
 * The bar's chips: the time range chip in its slot, then one chip per filter. Filters this server
 * can't run show muted with the reason, so they can be removed but are never silently dropped.
 */
export function TracesExplorerFilterChips({ timeRange, renderChip }: TracesExplorerFilterChipsProps) {
  const { withQueryTrace, withRootDuration, isCapabilitiesLoading } = useTracesConfig();
  // Nothing is marked until the capabilities load.
  const reason = (node: FilterBarNode) =>
    isCapabilitiesLoading ? undefined : unsupportedTraceFilterReason(node, { withQueryTrace, withRootDuration });
  return (
    <FilterBar.Chips
      renderChip={item => {
        if (item.fieldId === TRACE_TIME_RANGE_FIELD_ID) return timeRange ?? <TracesExplorerTimeRangeChip />;
        const unsupported = reason(item);
        if (unsupported) return <FilterBar.Chip item={item} unsupported={unsupported} />;
        return renderChip ? renderChip(item) : <FilterBar.Chip item={item} />;
      }}
      renderGroup={group => <FilterBar.AdvancedChip group={group} unsupported={reason(group)} />}
    />
  );
}

export type TracesExplorerTimeRangeChipProps = Partial<
  Pick<TraceTimeRangeChipProps, 'presets' | 'minDate' | 'maxRangeMs'>
>;

/** Its own component so a list loading flip only re-renders the chip, not the whole bar. */
export function TracesExplorerTimeRangeChip({
  presets = TIME_RANGE_PRESETS,
  minDate,
  maxRangeMs,
}: TracesExplorerTimeRangeChipProps) {
  const { filters, dateFrom, dateTo, setDatePreset, setDate, setDateRange } = useTracesFilters();
  const { isLoading } = useTracesList();

  return (
    <TraceTimeRangeChip
      preset={filters.datePreset}
      onPresetChange={setDatePreset}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateChange={setDate}
      onDateRangeChange={setDateRange}
      disabled={isLoading}
      presets={presets}
      minDate={minDate}
      maxRangeMs={maxRangeMs}
    />
  );
}
