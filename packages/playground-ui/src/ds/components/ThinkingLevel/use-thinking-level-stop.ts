import { useState } from 'react';
import type { ChangeEvent } from 'react';

import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface ThinkingLevelOption<T extends string = string> {
  value: T;
  label: string;
  /** `muted` means no thinking at all; `warning` marks a level whose cost climbs. */
  emphasis?: 'muted' | 'warning';
}

export const invisibleRangeInputClassName = cn(
  'cursor-pointer appearance-none bg-transparent',
  focusRing,
  '[&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:bg-transparent',
  '[&::-moz-range-thumb]:h-full [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-0',
  '[&::-moz-range-thumb]:bg-transparent',
);

export function useThinkingLevelStop<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly ThinkingLevelOption<T>[];
  value: T;
  onChange: (value: T) => void | Promise<unknown>;
}) {
  const [draggedStop, setDraggedStop] = useState<number>();
  const [heldRelease, setHeldRelease] = useState<{ stop: number }>();

  const settledStop = Math.max(
    options.findIndex(option => option.value === value),
    0,
  );
  const pendingStop = draggedStop ?? heldRelease?.stop;
  const shownStop = pendingStop ?? settledStop;

  // Holding the drop until the write settles: clearing it first shows the old
  // stop for a frame, then the new one — two jumps for one change.
  const commit = async () => {
    const stop = draggedStop;
    setDraggedStop(undefined);
    if (stop === undefined || stop === settledStop) return;
    const option = options[stop];
    if (!option) return;
    const release = { stop };
    setHeldRelease(release);
    try {
      await onChange(option.value);
    } finally {
      setHeldRelease(current => (current === release ? undefined : current));
    }
  };

  const commitOnRelease = () => void commit();

  return {
    shownStop,
    shownOption: options[shownStop],
    isPending: pendingStop !== undefined,
    rangeInputProps: {
      type: 'range',
      min: 0,
      max: Math.max(options.length - 1, 0),
      step: 1,
      value: shownStop,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setDraggedStop(Number(event.target.value)),
      onPointerUp: commitOnRelease,
      onPointerCancel: commitOnRelease,
      onKeyUp: commitOnRelease,
      onBlur: commitOnRelease,
    },
  };
}
