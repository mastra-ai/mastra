import { describe, expect, it } from 'vitest';

import {
  averageLatency,
  isDrillablePoint,
  isLatencyTab,
  latencyBucketScope,
  latencyTracesScope,
} from './latency-card.utils';

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

describe('latencyTracesScope', () => {
  describe('when a tab is active', () => {
    it('scopes traces to the entity type of the tab', () => {
      expect(latencyTracesScope('agents')).toEqual({ rootEntityType: 'agent' });
      expect(latencyTracesScope('workflows')).toEqual({ rootEntityType: 'workflow_run' });
      expect(latencyTracesScope('tools')).toEqual({ rootEntityType: 'tool' });
    });
  });
});

describe('latencyBucketScope', () => {
  describe('when an hourly bucket is clicked', () => {
    it('narrows the window to that hour', () => {
      const tsMs = new Date('2026-07-02T15:37:00.000Z').getTime();

      expect(latencyBucketScope('workflows', tsMs, '1h')).toEqual({
        rootEntityType: 'workflow_run',
        window: { from: new Date('2026-07-02T15:00:00.000Z'), to: new Date('2026-07-02T16:00:00.000Z') },
      });
    });
  });

  describe('when a daily bucket is clicked', () => {
    it('narrows the window to that UTC day', () => {
      const tsMs = new Date('2026-07-02T15:37:00.000Z').getTime();

      expect(latencyBucketScope('agents', tsMs, '1d').window).toEqual({
        from: new Date('2026-07-02T00:00:00.000Z'),
        to: new Date('2026-07-03T00:00:00.000Z'),
      });
    });
  });
});
