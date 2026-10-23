import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface SegmentStyle extends CSSProperties {
  '--meter-share': number;
}

export function MeterSegment({ slot, grow, className }: { slot: string; grow: number; className: string }) {
  const style: SegmentStyle = { '--meter-share': grow };
  return (
    <span
      data-slot={slot}
      className={cn('min-w-1 grow-(--meter-share) basis-0 rounded-full', className)}
      style={style}
    />
  );
}
