import { useId } from 'react';

import { cn } from '@/lib/utils';

// One hemisphere, scalloped into lobes; the other is its mirror, leaving a gap down the middle.
// Each is a single path so the translucent base never doubles up where shapes would overlap.
const HEMISPHERE =
  'M7.3 3.2C7.3 2.4 6.6 1.9 5.8 2.1C5 1.8 4.1 2.3 4 3.2C2.9 3.4 2.3 4.4 2.6 5.4C1.7 6 1.5 7.3 2.1 8.1C1.5 9 1.8 10.3 2.8 10.7C2.9 11.8 3.8 12.6 4.9 12.5C5.4 13.4 6.5 13.8 7.3 13.2Z';
const BRAIN_TOP = 1.9;
const BRAIN_BOTTOM = 13.7;

const brain = (
  <>
    <path d={HEMISPHERE} />
    <path d={HEMISPHERE} transform="matrix(-1 0 0 1 16 0)" />
  </>
);

/** A brain filled from the bottom: `fill` 0 is empty, 1 is full. */
export function ThinkingLevelBrain({ fill, className }: { fill: number; className?: string }) {
  const clipId = `thinking-brain-${useId().replace(/[^\w-]/g, '')}`;
  const top = BRAIN_BOTTOM - (BRAIN_BOTTOM - BRAIN_TOP) * Math.min(Math.max(fill, 0), 1);
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className={cn('size-4 shrink-0', className)}>
      <clipPath id={clipId}>
        <rect
          width={16}
          height={16}
          className="transition-transform duration-slow ease-out-custom motion-reduce:transition-none"
          style={{ transform: `translateY(${top}px)` }}
        />
      </clipPath>
      <g opacity={0.35}>{brain}</g>
      <g clipPath={`url(#${clipId})`}>{brain}</g>
    </svg>
  );
}
