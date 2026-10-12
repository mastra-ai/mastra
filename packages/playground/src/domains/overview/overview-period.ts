export type OverviewRange = '24h' | '7d' | '30d';

export interface PeriodWindow {
  start: Date;
  end: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const overviewRanges: OverviewRange[] = ['24h', '7d', '30d'];

export const periodLabels: Record<OverviewRange, string> = {
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
};

export const previousPeriodLabels: Record<OverviewRange, string> = {
  '24h': 'previous 24 hours',
  '7d': 'previous 7 days',
  '30d': 'previous 30 days',
};

export const bucketsByRange = {
  '24h': { interval: '1h', intervalMs: HOUR_MS, bucketMs: HOUR_MS },
  '7d': { interval: '1h', intervalMs: HOUR_MS, bucketMs: 6 * HOUR_MS },
  '30d': { interval: '1d', intervalMs: DAY_MS, bucketMs: DAY_MS },
} as const;

export function isOverviewRange(value: unknown): value is OverviewRange {
  return typeof value === 'string' && overviewRanges.some(range => range === value);
}

export function previousWindow({ start, end }: PeriodWindow): PeriodWindow {
  const span = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - span), end: start };
}

export function bucketCountOf(window: PeriodWindow, range: OverviewRange) {
  return Math.ceil((window.end.getTime() - window.start.getTime()) / bucketsByRange[range].bucketMs);
}

export function bucketIndexOf(timestampMs: number, window: PeriodWindow, range: OverviewRange) {
  return Math.floor((timestampMs - window.start.getTime()) / bucketsByRange[range].bucketMs);
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });

export function formatLastRun(bucketStartMs: number, range: OverviewRange, nowMs: number) {
  const { intervalMs } = bucketsByRange[range];
  const elapsedIntervals = Math.max(0, Math.floor((nowMs - bucketStartMs) / intervalMs));
  if (intervalMs === DAY_MS) return relativeTime.format(-elapsedIntervals, 'day');
  if (elapsedIntervals < 48) return relativeTime.format(-elapsedIntervals, 'hour');
  return relativeTime.format(-Math.floor(elapsedIntervals / 24), 'day');
}
