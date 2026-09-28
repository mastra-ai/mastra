import { formatDate, formatShortDate } from '../../utils/date-format';

export type MetricsInterval = '1h' | '1d';

const HOURLY_MAX_RANGE_MS = 48 * 60 * 60 * 1000;

/** Hourly buckets up to 48h, daily buckets beyond, so long ranges stay readable. */
export function chooseMetricsInterval({ start, end }: { start: Date; end: Date }): MetricsInterval {
  return end.getTime() - start.getTime() <= HOURLY_MAX_RANGE_MS ? '1h' : '1d';
}

export function formatMetricsBucketLabel(ts: Date, interval: MetricsInterval): string {
  if (interval === '1h') {
    return formatDate(ts, 'time') ?? '';
  }
  return formatShortDate(ts) ?? '';
}
