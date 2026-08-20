import { useId } from 'react';

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 32;
const PADDING = 2;

/** Runs of consecutive plotted points — a `null` breaks the line rather than dropping it to zero. */
function segmentsOf(values: (number | null)[]): { index: number; value: number }[][] {
  const segments: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length > 0) segments.push(run);
      run = [];
      return;
    }
    run.push({ index, value });
  });
  if (run.length > 0) segments.push(run);
  return segments;
}

export function Sparkline({
  values,
  color = 'var(--chart-trend)',
  className,
}: {
  values: (number | null)[];
  color?: string;
  className?: string;
}) {
  const gradientId = useId();
  const segments = segmentsOf(values);
  if (values.length < 2 || segments.length === 0) return null;

  // a flat line on the floor draws a trend that never happened
  const max = Math.max(...values.map(value => value ?? 0));
  if (max === 0) return null;
  const step = VIEW_WIDTH / (values.length - 1);
  const plotY = (value: number) => VIEW_HEIGHT - PADDING - (value / max) * (VIEW_HEIGHT - PADDING * 2);
  const path = (segment: { index: number; value: number }[]) =>
    `M ${segment.map(point => `${point.index * step},${plotY(point.value)}`).join(' L ')}`;
  const runs = segments.filter(segment => segment.length > 1);
  // a lone measurement is a point, not a line — dropping it draws a gap that never happened
  const dots = new Map(
    segments.filter(segment => segment.length === 1).map(segment => [segment[0]!.index, segment[0]!]),
  );
  const last = segments.at(-1)!.at(-1)!;
  dots.set(last.index, last);

  return (
    <div aria-hidden="true" className={`relative ${className ?? ''}`}>
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {runs.map(segment => (
          <g key={segment[0]!.index}>
            <path
              d={`${path(segment)} L ${segment.at(-1)!.index * step},${VIEW_HEIGHT} L ${segment[0]!.index * step},${VIEW_HEIGHT} Z`}
              fill={`url(#${gradientId})`}
            />
            <path
              d={path(segment)}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
      {/* dots in HTML, not SVG — preserveAspectRatio=none would squash a circle */}
      {[...dots.values()].map(point => (
        <span
          key={point.index}
          className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 0 3px color-mix(in oklab, ${color} 22%, transparent)`,
            left: `${(point.index / (values.length - 1)) * 100}%`,
            top: `${(plotY(point.value) / VIEW_HEIGHT) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
