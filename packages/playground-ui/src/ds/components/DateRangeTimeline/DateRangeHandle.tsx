import type { KeyboardEventHandler, PointerEventHandler } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  parseDate,
  type DateBoundary,
} from './lib/date-range-timeline';

interface DateRangeHandleProps {
  boundary: DateBoundary;
  position: number;
  value: number;
  valueText: string;
  min: number;
  max: number;
  active: boolean;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function DateRangeHandle({
  boundary,
  position,
  value,
  valueText,
  min,
  max,
  active,
  onPointerDown,
  onKeyDown,
}: DateRangeHandleProps) {
  const label = boundary === 'from' ? 'Start date handle' : 'End date handle';
  const date = parseDate(valueText);
  const accessibleValue = date ? format(date, 'MMMM d, yyyy') : valueText;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={accessibleValue}
      className="group absolute inset-y-0 z-30 w-11 -translate-x-1/2 cursor-ew-resize touch-none outline-hidden"
      style={{ left: `${position}%` }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span
        className={cn(
          'absolute top-1/2 left-1/2 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-xs bg-surface3 ring-1 transition-[width,box-shadow] duration-150 group-hover:w-2 group-focus-visible:w-2 group-focus-visible:ring-2 group-focus-visible:ring-accent3 motion-reduce:transition-none',
          active ? 'w-2 ring-2 ring-neutral3/40' : 'ring-border2',
        )}
        aria-hidden="true"
      />
    </div>
  );
}
