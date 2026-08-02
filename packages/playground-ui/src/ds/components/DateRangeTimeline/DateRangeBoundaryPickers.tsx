import { useRef } from 'react';
import { DateRangeBoundaryPicker } from './DateRangeBoundaryPicker';
import { useDateRangeBoundaryLayout } from './hooks/useDateRangeBoundaryLayout';
import type { DateBoundary } from './lib/date-range-timeline';
import type { DateRangeValue } from './types';

interface DateRangeBoundaryPickersProps {
  positions: { from: number; to: number };
  value: DateRangeValue;
  min: string;
  max: string;
  onSelect: (boundary: DateBoundary, value: string) => void;
}

const FALLBACK_PICKER_WIDTH = 'clamp(0px, calc(50% - 0.25rem), 10rem)';

export function DateRangeBoundaryPickers({ positions, value, min, max, onSelect }: DateRangeBoundaryPickersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layout = useDateRangeBoundaryLayout(containerRef, positions);

  return (
    <div ref={containerRef} className="relative h-16 sm:h-12">
      <div
        className="absolute top-0 min-w-0"
        style={{
          left: layout?.from.left ?? 0,
          width: layout?.from.width ?? FALLBACK_PICKER_WIDTH,
        }}
      >
        <DateRangeBoundaryPicker boundary="from" value={value.from} min={min} max={value.to} onSelect={onSelect} />
      </div>

      <div
        className="absolute top-0 min-w-0"
        style={{
          left: layout?.to.left ?? 'max(calc(50% + 0.25rem), calc(100% - 10rem))',
          width: layout?.to.width ?? FALLBACK_PICKER_WIDTH,
        }}
      >
        <DateRangeBoundaryPicker boundary="to" value={value.to} min={value.from} max={max} onSelect={onSelect} />
      </div>

      <div
        className="bg-border2 absolute top-11 h-4 w-px -translate-x-1/2 transition-[left] duration-150 ease-out motion-reduce:transition-none sm:top-8"
        style={{ left: `${positions.from}%` }}
        aria-hidden="true"
      />
      <div
        className="bg-border2 absolute top-11 h-4 w-px -translate-x-1/2 transition-[left] duration-150 ease-out motion-reduce:transition-none sm:top-8"
        style={{ left: `${positions.to}%` }}
        aria-hidden="true"
      />
    </div>
  );
}
