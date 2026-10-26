import { cn } from '@/lib/utils';

export type SparklineProps = {
  /** The values in order, oldest first. Only their shape is drawn: no axes, no labels. */
  values: number[];
  /** Line color. Default: the current text color. */
  color?: string;
  className?: string;
};

const W = 64;
const H = 16;

/** A tiny trend line, e.g. a row's series over the chart's range in a chart table. */
export function Sparkline({ values, color, className }: SparklineProps) {
  const max = Math.max(...values, 0);
  const step = W / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${i * step},${H - 1 - (max ? (v / max) * (H - 2) : 0)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      className={cn('h-5 w-24', className)}
      style={color ? { color } : undefined}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
