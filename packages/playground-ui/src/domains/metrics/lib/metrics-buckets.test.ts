import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bucketGrid, bucketPlan, bucketStart, bucketWindow, gridIndex, nextBucket } from './metrics-buckets';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Oct 6, 3:30 PM local time. */
const NOW = new Date(2026, 9, 6, 15, 30);
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe('bucketPlan', () => {
  it.each([
    ['24 hours', DAY, { interval: '1h', stepHours: 1 }],
    ['3 days', 3 * DAY, { interval: '1h', stepHours: 3 }],
    ['7 days', 7 * DAY, { interval: '1h', stepHours: 6 }],
    ['14 days', 14 * DAY, { interval: '1h', stepHours: 12 }],
    ['30 days', 30 * DAY, { interval: '1d', stepHours: 24 }],
  ])('keeps %s to a readable number of bars', (_, span, plan) => {
    expect(bucketPlan(ago(span), NOW)).toEqual(plan);
  });
});

describe('bucketStart and nextBucket', () => {
  it('aligns buckets to the step from local midnight', () => {
    expect(bucketStart(NOW.getTime(), 6)).toBe(new Date(2026, 9, 6, 12).getTime());
    expect(nextBucket(new Date(2026, 9, 6, 12).getTime(), 6)).toBe(new Date(2026, 9, 6, 18).getTime());
  });

  it('starts daily buckets on UTC midnight, like the API', () => {
    expect(bucketStart(NOW.getTime(), 24)).toBe(Date.UTC(2026, 9, 6));
    expect(nextBucket(Date.UTC(2026, 9, 6), 24)).toBe(Date.UTC(2026, 9, 7));
  });
});

describe('bucketGrid', () => {
  it('covers the last 24 hours hour by hour, including the current hour', () => {
    const grid = bucketGrid(ago(DAY), NOW, 1);
    expect(grid).toHaveLength(25);
    expect(grid[0]?.ts).toBe(new Date(2026, 9, 5, 15).getTime());
    expect(grid.at(-1)?.ts).toBe(new Date(2026, 9, 6, 15).getTime());
  });

  it('labels hours within a day, and gives edge labels their day', () => {
    const [first] = bucketGrid(ago(DAY), NOW, 1);
    expect(first?.label).toBe('3 PM');
    expect(first?.edgeLabel).toBe('Oct 5, 3 PM');
    expect(first?.time).toBe('Oct 5, 3 PM');
  });

  it('labels midnights with the day alone over several days', () => {
    const grid = bucketGrid(ago(7 * DAY), NOW, 6);
    const midnight = grid.find(b => b.ts === new Date(2026, 9, 1).getTime());
    const morning = grid.find(b => b.ts === new Date(2026, 9, 1, 6).getTime());
    expect(midnight?.label).toBe('Oct 1');
    expect(morning?.label).toBe('Oct 1, 6 AM');
  });

  it('labels daily buckets with the date', () => {
    const grid = bucketGrid(ago(30 * DAY), NOW, 24);
    expect(grid.at(-1)?.label).toBe('Oct 6');
    expect(grid.at(-1)?.time).toBe('Tue, Oct 6');
  });
});

describe('gridIndex', () => {
  it('finds the bucket holding a point, and none outside the grid', () => {
    const grid = bucketGrid(ago(7 * DAY), NOW, 6);
    const indexOf = gridIndex(grid, 6);
    const i = indexOf({ timestamp: new Date(2026, 9, 6, 13, 0).toISOString(), value: 1 });
    expect(i === undefined ? undefined : grid[i]?.ts).toBe(new Date(2026, 9, 6, 12).getTime());
    expect(indexOf({ timestamp: new Date(2026, 8, 1).toISOString(), value: 1 })).toBeUndefined();
  });
});

describe('bucketWindow', () => {
  it('spans one bucket, for opening its traces', () => {
    const ts = new Date(2026, 9, 6, 12).getTime();
    expect(bucketWindow(ts, 6)).toEqual({ from: new Date(ts), to: new Date(2026, 9, 6, 18) });
  });
});

describe('daily buckets outside UTC', () => {
  /** The API's 1d buckets for a 30-day window ending Oct 21, 2026, 7:45 PM UTC. */
  const end = new Date(Date.UTC(2026, 9, 21, 19, 45));
  const start = new Date(end.getTime() - 30 * DAY);
  const apiDays = Array.from({ length: 31 }, (_, i) => new Date(Date.UTC(2026, 8, 21 + i)).toISOString());

  describe.each(['America/New_York', 'Asia/Tokyo'])('when the browser is in %s', timeZone => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = timeZone;
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    it('puts every API day in its own bucket', () => {
      const grid = bucketGrid(start, end, 24);
      const indexOf = gridIndex(grid, 24);
      const indexes = apiDays.map(timestamp => indexOf({ timestamp, value: 1 }));
      expect(indexes).toEqual(apiDays.map((_, i) => i));
      expect(grid).toHaveLength(apiDays.length);
    });

    it('labels each bucket with its UTC date', () => {
      const grid = bucketGrid(start, end, 24);
      expect(grid[0]?.label).toBe('Sep 21');
      expect(grid.at(-1)?.label).toBe('Oct 21');
      expect(grid.at(-1)?.time).toBe('Wed, Oct 21');
    });
  });
});
