/* eslint-disable react-refresh/only-export-components */
import { CalendarIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { FilterBarChip, editableSegmentClass } from './filter-bar-chip';
import { useFilterBarContext } from './filter-bar-context';
import type { FilterBarField, FilterBarItem } from './types';
import { DateTimeRangePicker } from '@/ds/components/DateTimeRangePicker';
import type { DateTimeRangePickerProps } from '@/ds/components/DateTimeRangePicker';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron/disclosure-chevron';
import { cn } from '@/lib/utils';

export const FILTER_BAR_TIME_RANGE_FIELD_ID = 'timeRange';

/**
 * Synthetic field backing the time range control. Hidden from the input's field step (the
 * range cannot be added twice) but registered so the chip resolves its label and takes part
 * in keyboard navigation. Add it to the bar's `fields` and `FILTER_BAR_TIME_RANGE_ITEM` to its
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

export type FilterBarTimeRangeProps = Omit<DateTimeRangePickerProps, 'size' | 'renderTrigger'>;

const isSegment = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.hasAttribute('data-filter-bar-segment');

/**
 * A filter bar's time range: calendar, range, chevron, the same control as a standalone
 * `DateTimeRangePicker`. Always present and non-removable, so it reads as the bar's scope
 * rather than as a `field · value` filter.
 */
export function FilterBarTimeRange(props: FilterBarTimeRangeProps) {
  const ctx = useFilterBarContext();
  return (
    <FilterBarChip item={FILTER_BAR_TIME_RANGE_ITEM} removable={false}>
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
              ref={el => ctx.registerSegment(FILTER_BAR_TIME_RANGE_ITEM.id, 'value', el)}
              data-filter-bar-segment=""
              disabled={disabled}
              aria-label={`Time range: ${label}`}
              title={label}
              className={cn(editableSegmentClass, 'max-w-64 gap-1.5 text-foreground')}
            >
              <CalendarIcon className="size-[1.1em] shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{label}</span>
              <DisclosureChevron className="size-[1.1em] text-muted-foreground" />
            </button>
          )}
        />
      </div>
    </FilterBarChip>
  );
}
