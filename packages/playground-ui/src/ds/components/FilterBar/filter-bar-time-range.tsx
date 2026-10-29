/* eslint-disable react-refresh/only-export-components */
import { CalendarIcon } from 'lucide-react';
import { useRef } from 'react';
import { FILTER_BAR_CONTROL_SIZE } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import type { FilterBarField, FilterBarItem } from './types';
import { useFilterBarItemKeys } from './use-filter-bar-item-keys';
import { DateTimeRangePicker } from '@/ds/components/DateTimeRangePicker/date-time-range-picker';
import type { DateTimeRangePickerProps } from '@/ds/components/DateTimeRangePicker/date-time-range-picker';

export const FILTER_BAR_TIME_RANGE_FIELD_ID = 'timeRange';

/**
 * Synthetic field backing the time range control. Hidden from the input's field step (the
 * range cannot be added twice) but registered so the bar resolves its label and takes it into
 * keyboard navigation. Add it to the bar's `fields` and `FILTER_BAR_TIME_RANGE_ITEM` to its
 * `items`, then render `FilterBar.TimeRange` for that item from `FilterBar.Chips`.
 */
export const FILTER_BAR_TIME_RANGE_FIELD: FilterBarField = {
  id: FILTER_BAR_TIME_RANGE_FIELD_ID,
  label: 'Time',
  icon: CalendarIcon,
  type: 'text',
  operators: ['is'],
  hidden: true,
};

export const FILTER_BAR_TIME_RANGE_ITEM: FilterBarItem = {
  id: FILTER_BAR_TIME_RANGE_FIELD_ID,
  fieldId: FILTER_BAR_TIME_RANGE_FIELD_ID,
  operatorId: 'is',
  value: '',
};

export type FilterBarTimeRangeProps = Omit<DateTimeRangePickerProps, 'size' | 'ref'>;

/**
 * A filter bar's time range: the `DateTimeRangePicker` itself at the bar's rung, so it looks and
 * behaves exactly as it does anywhere else, reset × included. It scopes the bar rather than
 * filtering it, so it is not a removable chip; the wrapper only joins it to the bar's arrow-key
 * order.
 */
export function FilterBarTimeRange(props: FilterBarTimeRangeProps) {
  const ctx = useFilterBarContext();
  const rootRef = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useFilterBarItemKeys({
    item: FILTER_BAR_TIME_RANGE_ITEM,
    rootRef,
    pinned: true,
    removable: false,
    segmentSelector: 'button',
  });

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Time range"
      data-slot="filter-bar-time-range"
      className="flex"
      onKeyDown={onKeyDown}
    >
      <DateTimeRangePicker
        {...props}
        size={FILTER_BAR_CONTROL_SIZE}
        ref={el => ctx.registerSegment(FILTER_BAR_TIME_RANGE_ITEM.id, 'value', el)}
      />
    </div>
  );
}
