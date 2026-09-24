import { describe, expect, it } from 'vitest';

import { chooseMetricsInterval, formatMetricsBucketLabel } from './metrics-interval';

const HOUR = 60 * 60 * 1000;
const end = new Date('2026-09-24T12:00:00.000Z');
const rangeOf = (ms: number) => ({ start: new Date(end.getTime() - ms), end });

describe('chooseMetricsInterval', () => {
  it('uses hourly buckets up to 48h', () => {
    expect(chooseMetricsInterval(rangeOf(HOUR))).toBe('1h');
    expect(chooseMetricsInterval(rangeOf(24 * HOUR))).toBe('1h');
    expect(chooseMetricsInterval(rangeOf(48 * HOUR))).toBe('1h');
  });

  it('uses daily buckets beyond 48h', () => {
    expect(chooseMetricsInterval(rangeOf(48 * HOUR + 1))).toBe('1d');
    expect(chooseMetricsInterval(rangeOf(3 * 24 * HOUR))).toBe('1d');
    expect(chooseMetricsInterval(rangeOf(30 * 24 * HOUR))).toBe('1d');
  });
});

describe('formatMetricsBucketLabel', () => {
  const ts = new Date(2026, 8, 4, 7, 5);

  it('formats hourly buckets with the shared time format', () => {
    expect(formatMetricsBucketLabel(ts, '1h')).toBe(
      new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(ts),
    );
  });

  it('formats daily buckets as a short date', () => {
    expect(formatMetricsBucketLabel(ts, '1d')).toBe(
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: new Date().getFullYear() === 2026 ? undefined : 'numeric',
      }).format(ts),
    );
  });
});
