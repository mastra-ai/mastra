import { useId } from 'react';
import { CHART_MARGIN, X_AXIS_HEIGHT } from '@/ds/primitives/chart-layout';
import { useShimmerDelay } from '@/ds/primitives/shimmer';
import { cn } from '@/lib/utils';

export type ChartSkeletonProps = {
  /** Ghost shape: columns for bar charts, a curve for line charts. */
  kind: 'bar' | 'line';
  /** The chart's height, so the card doesn't change size when data lands. `fill` grows with the card. */
  height?: number | 'fill';
  className?: string;
};

/** Deterministic walk, so the ghost doesn't change shape between renders. */
function ghostValues(count: number, seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  let v = 0.45;
  return Array.from({ length: count }, () => {
    v = Math.min(0.85, Math.max(0.25, v + (rand() - 0.5) * 0.3));
    return v;
  });
}

/**
 * A chart while its data loads: faint ghost columns or a ghost curve with a light sweeping
 * across, in the chart's own footprint (plot plus x-axis band).
 */
export function ChartSkeleton({ kind, height = 210, className }: ChartSkeletonProps) {
  const id = `ghost${useId().replace(/:/g, '')}`;
  const delay = useShimmerDelay();
  const values = ghostValues(kind === 'bar' ? 24 : 16, kind === 'bar' ? 7 : 11);

  // Ghost shapes at a faint fill, and a 40-unit band of light that sweeps across them (masked
  // to the shapes), on the same clock as the text skeletons.
  let ghost;
  let mask;
  let peak;
  if (kind === 'bar') {
    const slot = 100 / values.length;
    const bars = values.map((v, i) => (
      <rect key={i} x={i * slot + slot * 0.15} width={slot * 0.7} y={100 - v * 100} height={v * 100} rx={0.4} />
    ));
    ghost = (
      <g fill="var(--foreground)" fillOpacity={0.07}>
        {bars}
      </g>
    );
    mask = <g fill="white">{bars}</g>;
    peak = 0.09;
  } else {
    const step = 100 / (values.length - 1);
    const pts = values.map((v, i) => [i * step, 100 - v * 100] as const);
    const line = pts
      .map(([x, y], i) => {
        const prev = pts[i - 1];
        if (!prev) return `M${x},${y}`;
        const [px, py] = prev;
        const cx = (px + x) / 2;
        return `C${cx},${py} ${cx},${y} ${x},${y}`;
      })
      .join(' ');
    const area = `${line} L100,100 L0,100 Z`;
    ghost = (
      <>
        <path d={area} fill="var(--foreground)" fillOpacity={0.025} />
        <path
          d={line}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.12}
          strokeWidth={1.75}
          vectorEffect="non-scaling-stroke"
        />
      </>
    );
    mask = (
      <>
        <path d={area} fill="white" fillOpacity={0.2} />
        <path d={line} fill="none" stroke="white" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      </>
    );
    peak = 0.18;
  }
  const shape = (
    <>
      <defs>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--foreground)" stopOpacity={0} />
          <stop offset="0.5" stopColor="var(--foreground)" stopOpacity={peak} />
          <stop offset="1" stopColor="var(--foreground)" stopOpacity={0} />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          {mask}
        </mask>
      </defs>
      {ghost}
      <g mask={`url(#${id}-mask)`}>
        <rect
          width={40}
          height={100}
          fill={`url(#${id}-band)`}
          className="animate-[chart-ghost-sweep_2s_infinite]"
          style={{ animationDelay: delay }}
        />
      </g>
    </>
  );

  const plot = (
    <>
      <div className="min-h-0 flex-1" style={{ paddingTop: CHART_MARGIN.top }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block size-full" aria-hidden>
          {shape}
        </svg>
      </div>
      <div style={{ height: X_AXIS_HEIGHT }} />
    </>
  );
  if (height === 'fill') {
    // The loaded chart's footprint: the free height, at least its minimum, out of flow.
    return (
      <div role="status" aria-label="Loading chart" className={cn('relative min-h-45 w-full flex-1', className)}>
        <div className="absolute inset-0 flex flex-col">{plot}</div>
      </div>
    );
  }
  return (
    <div role="status" aria-label="Loading chart" className={cn('flex w-full flex-col', className)} style={{ height }}>
      {plot}
    </div>
  );
}
