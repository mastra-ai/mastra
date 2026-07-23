import type { KeyboardEventHandler, PointerEventHandler } from 'react';
import { Txt } from '@/ds/components/Txt/Txt';
import { cn } from '@/lib/utils';

interface DateRangeSelectionProps {
  left: number;
  width: number;
  duration: string;
  active: boolean;
  value: number;
  valueText: string;
  max: number;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}

export function DateRangeSelection({
  left,
  width,
  duration,
  active,
  value,
  valueText,
  max,
  onPointerDown,
  onKeyDown,
}: DateRangeSelectionProps) {
  const visibleWidth = Math.max(width, 0.6);
  const visibleLeft = Math.min(left, 100 - visibleWidth);
  const showDuration = width >= 12;
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Move selected date range"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn(
        'absolute inset-y-1 z-10 flex cursor-grab touch-none items-center justify-center overflow-hidden rounded-md bg-neutral6/10 text-neutral6 select-none outline-hidden focus-visible:ring-2 focus-visible:ring-accent3 active:cursor-grabbing',
        active
          ? 'transition-none'
          : 'transition-[left,width,background-color] duration-150 ease-out motion-reduce:transition-none',
      )}
      style={{ left: `${visibleLeft}%`, width: `${visibleWidth}%` }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {showDuration ? (
        // TODO(ds): Txt needs a compact data-label variant.
        <Txt as="span" variant="ui-sm" font="mono" className="text-neutral6 tabular-nums">
          {duration}
        </Txt>
      ) : null}
    </div>
  );
}
