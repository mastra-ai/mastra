import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function DatePicker({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col space-y-4 sm:space-y-0 ',
        month: 'space-y-4 text-ui-sm ',
        caption: 'flex justify-between pt-1 items-center pl-2',
        caption_label: 'text-foreground font-medium',
        nav: 'flex items-center',
        nav_button_previous:
          'flex size-7 items-center justify-center rounded-md bg-transparent p-0 text-muted-foreground hover:bg-neutral6/5 hover:text-foreground',
        nav_button_next:
          'flex size-7 items-center justify-center rounded-md bg-transparent p-0 text-muted-foreground hover:bg-neutral6/5 hover:text-foreground',
        dropdown_month: 'w-full border-collapse space-y-1',
        weeknumber: 'flex',
        day: cn(
          'relative p-0 text-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-neutral6/10 [&:has([aria-selected].day-outside)]:bg-neutral6/5 [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
          'size-8 p-0 font-normal hover:bg-neutral6/5 aria-selected:opacity-100',
        ),
        day_range_start: 'day-range-start rounded-l-md',
        day_range_end: 'day-range-end rounded-r-md',
        day_selected: cn(
          'bg-neutral6! text-surface1! hover:bg-neutral6/90! focus:bg-neutral6/90! focus:text-surface1!',
          props.mode !== 'range' && 'rounded-md',
        ),
        day_today: 'bg-neutral6/10 text-foreground',
        day_outside:
          'day-outside text-muted-foreground opacity-50 aria-selected:bg-neutral6/5 aria-selected:text-muted-foreground aria-selected:opacity-30',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-neutral6/10 aria-selected:text-foreground',
        day_hidden: 'invisible',
        head_cell: 'text-ui-xs text-muted-foreground',
        ...classNames,
      }}
      {...props}
    />
  );
}
