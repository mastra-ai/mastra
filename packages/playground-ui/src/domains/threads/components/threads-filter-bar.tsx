import { TraceTimeRangeChip, TRACE_TIME_RANGE_FIELD_ID } from '../../traces/components/trace-time-range-chip';
import { TRACE_FILTER_BAR_OPERATORS } from '../../traces/trace-filters';
import type { TraceFilterGroup, TraceFilterToken } from '../../traces/trace-query-filters';
import type { TraceDatePreset } from '../../traces/types';
import {
  THREAD_TIME_RANGE_PRESETS,
  useThreadsFilterBar,
  useThreadsFilterBarFields,
} from '../hooks/use-threads-filter-bar';
import { FilterBar } from '@/ds/components/FilterBar';

// Items are rebuilt from tokens with `id: fieldId` (traceTokensToFilterBarItems); give the
// draft that id so the chip survives the round trip without remounting.
const createItemId = (fieldId: string) => fieldId;

export type ThreadsFilterBarProps = {
  datePreset: TraceDatePreset;
  dateFrom?: Date;
  dateTo?: Date;
  /** Earliest date the custom range picker allows. */
  minDate?: Date;
  tokens: TraceFilterToken[];
  groups: TraceFilterGroup[];
  onDatePresetChange: (preset: TraceDatePreset) => void;
  onDateChange: (value: Date | undefined, type: 'from' | 'to') => void;
  onDateRangeChange: (from: Date | undefined, to: Date | undefined) => void;
  onFiltersChange: (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;
  disabled?: boolean;
};

/** The threads filter bar: a time range chip plus the fields `queryTraceThreads()` accepts. */
export function ThreadsFilterBar({
  datePreset,
  dateFrom,
  dateTo,
  minDate,
  tokens,
  groups,
  onDatePresetChange,
  onDateChange,
  onDateRangeChange,
  onFiltersChange,
  disabled,
}: ThreadsFilterBarProps) {
  const fields = useThreadsFilterBarFields();
  const { filterBarValue, onFilterBarChange } = useThreadsFilterBar({ tokens, groups, onFiltersChange });

  return (
    <FilterBar
      fields={fields}
      operators={TRACE_FILTER_BAR_OPERATORS}
      value={filterBarValue}
      onValueChange={onFilterBarChange}
      createItemId={createItemId}
      maxDepth={3}
      aria-label="Thread filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips
        renderChip={item =>
          item.fieldId === TRACE_TIME_RANGE_FIELD_ID ? (
            <TraceTimeRangeChip
              preset={datePreset}
              onPresetChange={onDatePresetChange}
              dateFrom={dateFrom}
              dateTo={dateTo}
              minDate={minDate}
              onDateChange={onDateChange}
              onDateRangeChange={onDateRangeChange}
              disabled={disabled}
              presets={THREAD_TIME_RANGE_PRESETS}
            />
          ) : (
            <FilterBar.Chip item={item} />
          )
        }
      />
      <FilterBar.Input placeholder="Filter threads…" />
    </FilterBar>
  );
}
