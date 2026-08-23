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

/** Averages one percentile over the charted points, rounded to whole milliseconds. */
export function averageLatency(data: Record<string, unknown>[], key: 'p50' | 'p95'): string {
  if (data.length === 0) return '0';
  return `${Math.round(data.reduce((sum, point) => sum + (point[key] as number), 0) / data.length)}`;
}

/**
 * A chart node only stands for a moment in time when recharts hands back a
 * payload carrying a usable timestamp — anything else must not drill down.
 */
export function isDrillablePoint(point: unknown): point is LatencyPoint {
  const candidate = point as LatencyPoint | undefined;
  return typeof candidate?.tsMs === 'number' && Number.isFinite(candidate.tsMs);
}
