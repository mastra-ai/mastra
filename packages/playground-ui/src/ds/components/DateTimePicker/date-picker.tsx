import { cn } from '@/lib/utils';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function DatePicker({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col space-y-4 sm:space-y-0 ',
        month: 'space-y-4 text-[0.75rem] ',
        caption: 'flex justify-between pt-1 items-center pl-2',
        caption_label: 'text-text font-medium ',
        nav: 'flex items-center',
        nav_button_previous: cn(
          'flex justify-center items-center h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        nav_button_next: cn('flex justify-center items-center h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'),
        dropdown_month: 'w-full border-collapse space-y-1',
        weeknumber: 'flex',
        day: cn(
          'relative p-0 text-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-surface5 [&:has([aria-selected].day-outside)]:bg-surface5/50 [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
          'h-8 w-8 p-0 hover:bg-lightGray-7/50 font-normal aria-selected:opacity-100',
        ),
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_selected:
          '!bg-icon6/50 !text-surface2 hover:bg-icon6 rounded-md hover:text-surface2 focus:bg-icon6 focus:text-surface2',
        day_today: 'bg-icon6/10 text-icon5',
        day_outside:
          'day-outside text-icon3 opacity-50  aria-selected:bg-surface5/50 aria-selected:text-icon3 aria-selected:opacity-30',
        day_disabled: 'text-icon3 opacity-50',
        day_range_middle: 'aria-selected:bg-surface5 aria-selected:text-icon5',
        day_hidden: 'invisible',
        head_cell: 'text-[0.625rem] text-icon3',
        ...classNames,
      }}
      {...props}
    />
  );
}
