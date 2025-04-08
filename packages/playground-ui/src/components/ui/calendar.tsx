'use client';

import { CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '../../lib/utils';

import { buttonVariants } from './button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col space-y-4 sm:space-y-0',
        month: 'space-y-4',
        // month_caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm text-text font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          'absolute left-4 top-[56px] z-10',
        ),
        nav_button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
          'absolute right-4 top-[56px] z-10',
        ),
        dropdown_month: 'w-full border-collapse space-y-1',
        weeknumber: 'flex',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
          'h-8 w-8 p-0 hover:bg-lightGray-7/50 font-normal aria-selected:opacity-100',
        ),
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_selected:
          '!bg-primary !text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-lightGray-7/50 text-accent-foreground',
        day_outside:
          'day-outside text-muted-foreground opacity-50  aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={
        {
          // IconDropdown: ({  }) => (
          //   <CalendarIcon
          //     className={cn('h-4 w-4', {
          //       'rotate-180': orientation === 'up',
          //       'rotate-90': orientation === 'left',
          //       '-rotate-90': orientation === 'right',
          //     })}
          //   />
          // ),
        }
      }
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
