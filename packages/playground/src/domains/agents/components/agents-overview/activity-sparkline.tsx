import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Values over time as a line over a fading area; pass a shared `peak` so heights compare across sparklines. */
export function ActivitySparkline({
  runsPerBucket,
  peak,
  label,
  height = 48,
  className = 'text-chart-blue',
}: {
  runsPerBucket: number[];
  peak: number;
  label: string;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
  const lastIndex = Math.max(runsPerBucket.length - 1, 1);
  const points = runsPerBucket.map((runs, index) => {
    const x = (index / lastIndex) * 100;
    const y = height - 1 - (peak > 0 ? (runs / peak) * (height - 4) : 0);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${points.join(' L')}`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={cn('w-full overflow-visible', className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L100,${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
