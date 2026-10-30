import type { TraceQueryDiscoveryTimeRange } from '@mastra/react/hooks/traces';
import { DEFAULT_TRACES_FILTERS } from '../../traces/components/traces-explorer/traces-explorer-actions';
import { TRACE_FILTER_BAR_OPERATORS } from '../../traces/trace-filters';
import type { TraceFilterGroup, TraceFilterToken } from '../../traces/trace-query-filters';
import type { TraceDatePreset } from '../../traces/types';
import { SPAN_TIME_RANGE_PRESETS, useSpansFilterBar, useSpansFilterBarFields } from '../hooks/use-spans-filter-bar';
import { FilterBar } from '@/ds/components/FilterBar';
import { FILTER_BAR_TIME_RANGE_FIELD_ID } from '@/ds/components/FilterBar/filter-bar-time-range';

// Items are rebuilt from tokens with `id: fieldId` (traceTokensToFilterBarItems); give the
// draft that id so the chip survives the round trip without remounting.
const createItemId = (fieldId: string) => fieldId;

export type SpansFilterBarProps = {
  datePreset: TraceDatePreset;
  dateFrom?: Date;
  dateTo?: Date;
  /** Earliest date the custom range picker allows. */
  minDate?: Date;
  /** Window the value suggestions are looked up in. */
  timeRange: TraceQueryDiscoveryTimeRange;
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
  onDatePresetChange: (preset: TraceDatePreset) => void;
  onDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  onDateRangeChange: (from: Date | undefined, to: Date | undefined) => void;
  /** Called by the time range chip's × with the default preset, e.g. to undo a histogram zoom first. */
  onDateReset?: (defaultPreset: TraceDatePreset) => void;
  onFiltersChange: (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;
  /** Turns a failed value suggestions lookup into the message shown in the option list. */
  describeSuggestionsError?: (error: unknown) => string | undefined;
  disabled?: boolean;
};

/** The spans filter bar: the time range plus the fields `querySpans()` accepts. */
export function SpansFilterBar({
  datePreset,
  dateFrom,
  dateTo,
  minDate,
  timeRange,
  tokens,
  groups,
  onDatePresetChange,
  onDateChange,
  onDateRangeChange,
  onDateReset,
  onFiltersChange,
  describeSuggestionsError,
  disabled,
}: SpansFilterBarProps) {
  const fields = useSpansFilterBarFields({ timeRange });
  const { filterBarValue, onFilterBarChange } = useSpansFilterBar({ tokens, groups, onFiltersChange });

  return (
    <FilterBar
      fields={fields}
      operators={TRACE_FILTER_BAR_OPERATORS}
      value={filterBarValue}
      onValueChange={onFilterBarChange}
      createItemId={createItemId}
      describeSuggestionsError={describeSuggestionsError}
      maxDepth={3}
      aria-label="Span filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips
        renderChip={item =>
          item.fieldId === FILTER_BAR_TIME_RANGE_FIELD_ID ? (
            <FilterBar.TimeRange
              preset={datePreset}
              onPresetChange={onDatePresetChange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              minDate={minDate}
              onDateChange={onDateChange}
              onDateRangeChange={onDateRangeChange}
              disabled={disabled}
              presets={SPAN_TIME_RANGE_PRESETS}
              defaultPreset={DEFAULT_TRACES_FILTERS.datePreset}
              onReset={onDateReset && (() => onDateReset(DEFAULT_TRACES_FILTERS.datePreset))}
            />
          ) : (
            <FilterBar.Chip item={item} />
          )
        }
      />
      <FilterBar.Input placeholder="Filter spans…" />
    </FilterBar>
  );
}
