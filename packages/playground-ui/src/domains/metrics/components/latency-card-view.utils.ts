import type { LatencyPoint } from '../hooks/use-latency-metrics';

export type LatencyTab = 'agents' | 'workflows' | 'tools';

/**
 * Pure helpers behind the latency card. Kept apart from the component because
 * everything here is reached through recharts callbacks and legend rendering,
 * which lay out nothing under jsdom.
 */

export function isLatencyTab(value: string): value is LatencyTab {
  return value === 'agents' || value === 'workflows' || value === 'tools';
}

/**
 * Averages one percentile over the charted points, rounded to whole milliseconds.
 * The chart hands its aggregate untyped rows, so a bucket missing the percentile
 * counts as zero rather than turning the whole average into `NaN` on screen.
 */
export function averageLatency(data: Record<string, unknown>[], key: 'p50' | 'p95'): string {
  if (data.length === 0) return '0';
  const total = data.reduce((sum, point) => {
    const value = point[key];
    return sum + (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  }, 0);
  return `${Math.round(total / data.length)}`;
}

/**
 * A chart node only stands for a moment in time when recharts hands back a
 * payload carrying a usable timestamp — anything else must not drill down.
 */
export function isDrillablePoint(point: unknown): point is LatencyPoint {
  const candidate = point as LatencyPoint | undefined;
  return typeof candidate?.tsMs === 'number' && Number.isFinite(candidate.tsMs);
}
