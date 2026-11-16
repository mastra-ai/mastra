import * as React from 'react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';
import type { ChevronProps, DayButton } from 'react-day-picker';
import { IconChevronLeft } from '@/ds/icons/central/IconChevronLeft';
import { IconChevronRight } from '@/ds/icons/central/IconChevronRight';
import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * A month grid for picking a day or a range of days. Ranges read as one continuous band:
 * the ends are solid inverse pills and the days between sit on a quiet fill that runs
 * edge to edge, rounding off where a week starts or ends.
 */
export function DatePicker({ className, classNames, showOutsideDays = true, components, ...props }: CalendarProps) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('w-full p-3 [--cell-size:--spacing(8)]', className)}
      classNames={{
        // Width lives on className alone so a caller's width class can replace it.
        root: defaults.root,
        months: cn('relative flex flex-col gap-6 sm:flex-row', defaults.months),
        month: cn('flex w-full flex-col gap-2', defaults.month),
        // The nav overlays the caption row, so a two-month grid gets one ‹ on the far
        // left and one › on the far right, with each month's name centred above it.
        nav: cn(
          'pointer-events-none absolute inset-x-0 top-0 flex h-(--cell-size) items-center justify-between',
          defaults.nav,
        ),
        button_previous: cn(navButton, defaults.button_previous),
        button_next: cn(navButton, defaults.button_next),
        month_caption: cn('flex h-(--cell-size) items-center justify-center', defaults.month_caption),
        caption_label: cn('text-label text-foreground select-none', defaults.caption_label),
        month_grid: cn('w-full border-collapse', defaults.month_grid),
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn(
          'flex size-(--cell-size) grow items-center justify-center text-caption text-muted-foreground select-none',
          defaults.weekday,
        ),
        week: cn('mt-0.5 flex w-full', defaults.week),
        day: cn('group/day relative size-(--cell-size) grow p-0 text-center select-none', defaults.day),
        // The band is painted on the cells, behind the day buttons: half a cell behind
        // each end, a full cell behind the days between, rounded at the week's edges and
        // where the month ends (next to a hidden spill-over day).
        range_start: cn(
          'bg-linear-to-r from-transparent from-50% to-fill to-50% last:bg-none [&.rdp-range_end]:bg-none [&:has(+.rdp-hidden)]:bg-none',
          defaults.range_start,
        ),
        range_middle: cn(
          'bg-fill first:rounded-l-full last:rounded-r-full [&:has(+.rdp-hidden)]:rounded-r-full [.rdp-hidden+&]:rounded-l-full',
          defaults.range_middle,
        ),
        range_end: cn(
          'bg-linear-to-l from-transparent from-50% to-fill to-50% first:bg-none [.rdp-hidden+&]:bg-none',
          defaults.range_end,
        ),
        today: defaults.today,
        outside: defaults.outside,
        disabled: defaults.disabled,
        hidden: cn('invisible', defaults.hidden),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

const navButton = cn(
  'pointer-events-auto flex size-(--cell-size) items-center justify-center rounded-full text-muted-foreground',
  'not-aria-disabled:hover:bg-fill-subtle not-aria-disabled:hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none',
  'aria-disabled:opacity-40',
);

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon = orientation === 'left' ? IconChevronLeft : IconChevronRight;
  return <Icon className={cn('size-4', className)} />;
}

function CalendarDayButton({ className, day: _day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const isEnd = modifiers.range_start || modifiers.range_end;
  const isSolid = modifiers.selected && (isEnd || !modifiers.range_middle);

  return (
    <button
      ref={ref}
      type="button"
      data-today={modifiers.today || undefined}
      className={cn(
        'relative mx-auto flex size-(--cell-size) items-center justify-center rounded-full text-body-sm text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        'not-disabled:hover:bg-fill-hover',
        // Today: a dot under the number, so it never competes with a selection.
        'data-today:after:absolute data-today:after:bottom-1 data-today:after:size-1 data-today:after:rounded-full data-today:after:bg-current',
        modifiers.outside && 'text-muted-foreground/60',
        isSolid &&
          'bg-fill-inverse font-medium text-background not-disabled:hover:bg-fill-inverse-hover data-today:after:bg-background',
        modifiers.disabled && 'cursor-not-allowed text-muted-foreground/40',
        className,
      )}
      {...props}
    />
  );
}
