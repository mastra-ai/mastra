/* eslint-disable react-refresh/only-export-components */
import { XIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { traceFilterFieldColor, traceFilterFieldIcon } from '../trace-filters';
import type { DateRangePreset, DateTimeRangePickerProps } from '@/ds/components/DateTimeRangePicker';
import { DateTimeRangePicker } from '@/ds/components/DateTimeRangePicker';
import {
  FilterBarChip,
  FilterBarFieldLabel,
  editableSegmentClass,
  fieldSegmentAccentStyle,
  removeSegmentClass,
  segmentClass,
} from '@/ds/components/FilterBar/filter-bar-chip';
import { useFilterBarContext } from '@/ds/components/FilterBar/filter-bar-context';
import type { FilterBarField, FilterBarItem } from '@/ds/components/FilterBar/types';
import { cn } from '@/lib/utils';

export const TRACE_TIME_RANGE_FIELD_ID = 'timeRange';

/**
 * Synthetic FilterBar field backing the always-present time-range chip. Hidden from the
 * input's field step (the chip cannot be added twice) but registered so the chip resolves
 * its label and takes part in keyboard navigation.
 */
export const TRACE_TIME_RANGE_FIELD: FilterBarField = {
  id: TRACE_TIME_RANGE_FIELD_ID,
  label: 'Time',
  icon: traceFilterFieldIcon(TRACE_TIME_RANGE_FIELD_ID),
  color: traceFilterFieldColor(TRACE_TIME_RANGE_FIELD_ID),
  type: 'text',
  operators: ['is'],
  hidden: true,
};

export const TRACE_TIME_RANGE_ITEM: FilterBarItem = {
  id: TRACE_TIME_RANGE_FIELD_ID,
  fieldId: TRACE_TIME_RANGE_FIELD_ID,
  operatorId: 'is',
  value: '',
};

export type TraceTimeRangeChipProps = Pick<
  DateTimeRangePickerProps,
  | 'preset'
  | 'onPresetChange'
  | 'dateFrom'
  | 'dateTo'
  | 'onDateChange'
  | 'onDateRangeChange'
  | 'disabled'
  | 'maxRangeMs'
  | 'minDate'
  | 'presets'
> & {
  /** Shows a × that switches back to this preset whenever another range is selected. */
  defaultPreset?: DateRangePreset;
};

const isSegment = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.hasAttribute('data-filter-bar-segment');

/**
 * The trace list's date range rendered as a FilterBar chip: `Time <preset>`. Always
 * present and non-removable; the value segment opens the regular DateTimeRangePicker
 * menu/popover. With `defaultPreset`, a trailing × resets the range to it.
 */
export function TraceTimeRangeChip({ defaultPreset, ...props }: TraceTimeRangeChipProps) {
  const ctx = useFilterBarContext();
  const canReset = defaultPreset !== undefined && props.preset !== defaultPreset;
  return (
    <FilterBarChip item={TRACE_TIME_RANGE_ITEM} removable={false}>
      <span className={cn(segmentClass, 'text-foreground')} style={fieldSegmentAccentStyle(TRACE_TIME_RANGE_FIELD)}>
        <FilterBarFieldLabel field={TRACE_TIME_RANGE_FIELD} />
      </span>
      {/* The picker popup is portaled but bubbles React events through here — keep its
          keystrokes from reaching the chip's arrow-key navigation. */}
      <div
        className="contents"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (!isSegment(event.target)) event.stopPropagation();
        }}
      >
        <DateTimeRangePicker
          {...props}
          renderTrigger={({ label, disabled }) => (
            <button
              type="button"
              ref={el => ctx.registerSegment(TRACE_TIME_RANGE_ITEM.id, 'value', el)}
              data-filter-bar-segment=""
              disabled={disabled}
              aria-label={`Value: ${label}`}
              title={label}
              className={editableSegmentClass}
            >
              <span className="truncate">{label}</span>
            </button>
          )}
        />
      </div>
      {canReset && (
        <button
          type="button"
          data-filter-bar-segment=""
          tabIndex={-1}
          ref={el => ctx.registerSegment(TRACE_TIME_RANGE_ITEM.id, 'remove', el)}
          disabled={props.disabled}
          aria-label="Reset time range"
          title="Reset time range"
          className={removeSegmentClass}
          onClick={() => props.onPresetChange?.(defaultPreset)}
        >
          <XIcon className="size-[1.1em]" />
        </button>
      )}
    </FilterBarChip>
  );
}
