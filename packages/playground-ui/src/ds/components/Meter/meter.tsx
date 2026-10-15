import type { CSSProperties, ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type MeterProps = Omit<ComponentProps<'span'>, 'children'> & {
  value: number;
  max: number;
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-label'?: never; 'aria-labelledby': string });

export function Meter({ value, max, className, ...props }: MeterProps) {
  const used = Math.max(0, value);
  const allowance = Math.max(0, max);
  const over = Math.max(0, used - allowance);
  const within = used - over;
  const rest = allowance - within;

  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={allowance}
      aria-valuenow={within}
      data-over={over > 0 || undefined}
      className={cn('flex h-1 w-full min-w-0 gap-0.5', className)}
      {...props}
    >
      {within > 0 && <Segment part="used" grow={within} />}
      {over > 0 && <Segment part="over" grow={over} />}
      {(rest > 0 || used === 0) && <Segment part="rest" grow={rest || 1} />}
    </span>
  );
}

const segmentClassNames = {
  used: 'bg-foreground',
  over: 'bg-destructive-indicator',
  rest: 'bg-fill-strong',
} satisfies Record<string, string>;

interface SegmentStyle extends CSSProperties {
  '--meter-share': number;
}

function Segment({ part, grow }: { part: keyof typeof segmentClassNames; grow: number }) {
  const style: SegmentStyle = { '--meter-share': grow };
  return (
    <span
      data-slot={`meter-${part}`}
      className={cn('min-w-1 grow-(--meter-share) basis-0 rounded-full', segmentClassNames[part])}
      style={style}
    />
  );
}
