'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';
import { DayFlag, DayPicker, SelectionState, UI } from 'react-day-picker';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function DatePicker({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        [UI.Months]: 'flex flex-col space-y-4 sm:space-y-0 ',
        [UI.Month]: 'space-y-4 text-[0.75rem] ',
        [UI.MonthCaption]: 'flex justify-between pt-1 items-center pl-2',
        [UI.CaptionLabel]: 'text-text font-medium ',
        [UI.Nav]: 'flex items-center',
        [UI.PreviousMonthButton]: cn(
          'flex justify-center items-center h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        [UI.NextMonthButton]: cn('flex justify-center items-center h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'),
        [UI.MonthsDropdown]: 'w-full border-collapse space-y-1',
        [UI.WeekNumber]: 'flex',
        [UI.Day]: cn(
          'relative p-0 text-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
          'h-8 w-8 p-0 hover:bg-lightGray-7/50 font-normal aria-selected:opacity-100',
        ),
        [SelectionState.range_start]: 'day-range-start',
        [SelectionState.range_end]: 'day-range-end',
        [SelectionState.selected]: '!bg-primary/50 !text-primary-foreground hover:bg-primary rounded-md hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        [DayFlag.today]: 'bg-primary/10 text-accent-foreground',
        [DayFlag.outside]: 'day-outside text-muted-foreground opacity-50  aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        [DayFlag.disabled]: 'text-muted-foreground opacity-50',
        [SelectionState.range_middle]: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        [UI.Weekday]: 'text-[0.625rem] text-muted-foreground',
        ...classNames,
      }}
      {...props}
    />
  );
}
