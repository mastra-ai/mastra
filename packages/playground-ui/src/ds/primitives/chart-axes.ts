import { useLayoutEffect, useRef, useState } from 'react';
import { CHART_AXIS_FONT_SIZE, CHART_MARGIN, X_AXIS_HEIGHT } from './chart-layout';

/** Horizontal rulers: short dashes on the border color at half strength. */
export const CHART_GRID_PROPS = {
  vertical: false,
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  strokeOpacity: 0.5,
} as const;

/** Hover line of line charts: dashed like the grid, full border color, a hair thinner than a series. */
export const CHART_CURSOR_PROPS = { stroke: 'var(--border)', strokeDasharray: '3 3', strokeWidth: 0.8 } as const;

/**
 * How x-axis labels are placed.
 * - `auto`: as many labels as fit the width, on round clock times (12 AM, 6 AM, ...) when the
 *   rows carry timestamps, so every chart on a page shares one time grid.
 * - `edges`: only the first and last bucket, pinned to the plot's edges (small cards).
 */
export type ChartXLabels = 'auto' | 'edges';

export type ChartSize = { width: number; height: number };

/**
 * The chart's size, read before the first paint (so labels and the y tick count are right on
 * the first frame, no jump) and kept current by ResponsiveContainer's `onResize`.
 */
export function useChartSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setSize({ width: rect.width, height: rect.height });
  }, []);
  const onResize = (width: number, height: number) =>
    setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  return { size, onResize, ref };
}

/** About one gridline per 48px of plot, 3 to 5 ticks, on Recharts' round values. */
export function chartYTickCount(height: number) {
  if (!height) return 3;
  const plot = height - X_AXIS_HEIGHT - CHART_MARGIN.top;
  return Math.min(5, Math.max(3, Math.round(plot / 48) + 1));
}

const HOUR = 3_600_000;
/** Round label steps, in hours: 1h ... 12h, then days and a week. */
const STEPS = [1, 2, 3, 4, 6, 12, 24, 48, 168];
/** Minimum clear space between two x-axis labels. */
const LABEL_GAP = 48;
/** Rough label width at the axis font size. */
export const labelWidth = (text: string) => text.length * CHART_AXIS_FONT_SIZE * 0.58;

/**
 * Which buckets get a label: the smallest round step whose labels fit the width, on
 * clock-aligned times (hours divisible by the step, days on local midnight). Without
 * timestamps, evenly spaced buckets that fit; when fewer than three would show, just the
 * first and last bucket.
 */
export function pickTimeTicks(
  timestamps: Array<number | undefined>,
  labels: string[],
  plotWidth: number,
  mode: ChartXLabels = 'auto',
): Set<number> {
  const last = labels.length - 1;
  const ends = new Set([0, last]);
  if (mode === 'edges' || labels.length < 3) return ends;
  const widest = Math.max(...labels.map(l => labelWidth(l)));
  const fit = Math.floor(plotWidth / (widest + LABEL_GAP));
  if (fit < 3) return ends;
  const ts = timestamps.every(t => typeof t === 'number' && Number.isFinite(t)) ? (timestamps as number[]) : null;
  const bucket = ts ? (ts[1] ?? 0) - (ts[0] ?? 0) : 0;
  if (!ts || !(bucket > 0)) {
    // No time grid to align to: every `every`-th bucket, ending on the last one.
    const every = Math.ceil(labels.length / fit);
    const even = new Set<number>();
    for (let i = 0; i <= last; i += every) even.add(i);
    if (!even.has(last)) {
      if (last % every < every / 2) even.delete(last - (last % every));
      even.add(last);
    }
    return even.size < 3 ? ends : even;
  }
  const span = (ts.length * bucket) / HOUR;
  const step = STEPS.find(n => n * HOUR >= bucket && (n * HOUR) % bucket === 0 && span / n <= fit) ?? 168;
  const picked = new Set<number>();
  ts.forEach((t, i) => {
    const d = new Date(t);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const onStep =
      step < 24
        ? d.getMinutes() === 0 && d.getHours() % step === 0
        : d.getHours() === 0 && Math.round(midnight / (24 * HOUR)) % (step / 24) === 0;
    if (onStep) picked.add(i);
  });
  // Two clock labels land off-centre (one mid-plot, one at an edge): label the ends instead.
  return picked.size < 3 ? ends : picked;
}
