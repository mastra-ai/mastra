import { describe, expect, it } from 'vitest';

import { averageLatency, isDrillablePoint, isLatencyTab } from './latency-card-view.utils';

describe('isLatencyTab', () => {
  it.each(['agents', 'workflows', 'tools'])('recognizes %s', value => {
    expect(isLatencyTab(value)).toBe(true);
  });

  it.each(['', 'Agents', 'agent', 'traces', 'undefined'])('does not recognize %s', value => {
    expect(isLatencyTab(value)).toBe(false);
  });
});

describe('averageLatency', () => {
  it('averages the percentile it was asked for', () => {
    const data = [
      { p50: 100, p95: 900 },
      { p50: 300, p95: 1100 },
    ];

    expect(averageLatency(data, 'p50')).toBe('200');
    expect(averageLatency(data, 'p95')).toBe('1000');
  });

  it('rounds to whole milliseconds', () => {
    expect(averageLatency([{ p50: 100 }, { p50: 101 }], 'p50')).toBe('101');
    expect(averageLatency([{ p50: 100 }, { p50: 100 }, { p50: 101 }], 'p50')).toBe('100');
  });

  it('reads a single point as its own average', () => {
    expect(averageLatency([{ p50: 7470 }], 'p50')).toBe('7470');
  });

  it('counts a bucket missing its percentile as zero rather than spoiling the average', () => {
    expect(averageLatency([{ p50: 100 }, {}, { p50: 200 }], 'p50')).toBe('100');
    expect(averageLatency([{ p50: 100 }, { p50: 'n/a' }], 'p50')).toBe('50');
    expect(averageLatency([{ p50: Number.NaN }, { p50: 100 }], 'p50')).toBe('50');
  });

  it('reads nothing charted as zero', () => {
    expect(averageLatency([], 'p50')).toBe('0');
  });
});

describe('isDrillablePoint', () => {
  it('accepts a point stamped with a real moment', () => {
    expect(isDrillablePoint({ time: '15:00', tsMs: 1_780_000_000_000, p50: 1, p95: 2 })).toBe(true);
  });

  it('accepts the epoch itself', () => {
    expect(isDrillablePoint({ tsMs: 0 })).toBe(true);
  });

  it.each([
    ['nothing at all', undefined],
    ['a null payload', null],
    ['a point with no timestamp', { p50: 1 }],
    ['a timestamp that is not a number', { tsMs: '1780000000000' }],
    ['a timestamp that is not finite', { tsMs: Number.POSITIVE_INFINITY }],
    ['a timestamp that is not a date at all', { tsMs: Number.NaN }],
  ])('refuses %s', (_, point) => {
    expect(isDrillablePoint(point)).toBe(false);
  });
});
