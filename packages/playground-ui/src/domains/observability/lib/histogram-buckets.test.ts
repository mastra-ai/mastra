import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bucketCountRows, exceedsAggregateWindow, histogramPlan, MAX_HISTOGRAM_BARS } from './histogram-buckets';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const range = (start: Date, end: Date) => ({ from: start.toISOString(), to: end.toISOString() });
const lastDays = (days: number, end = new Date(Date.UTC(2026, 9, 21, 9, 37))) =>
  range(new Date(end.getTime() - days * DAY), end);

/** Mirrors `countTraceAggregateBuckets` in `@mastra/core/storage`: the buckets the server would answer. */
const API_INTERVAL_MS = { '1m': MINUTE, '5m': 5 * MINUTE, '15m': 15 * MINUTE, '1h': HOUR, '1d': DAY };
const apiBuckets = ({ from, to }: { from: string; to: string }, interval: keyof typeof API_INTERVAL_MS) => {
  const ms = API_INTERVAL_MS[interval];
  return Math.floor((Date.parse(to) - 1) / ms) - Math.floor(Date.parse(from) / ms) + 1;
};

describe('histogramPlan', () => {
  describe.each([
    { days: 1, stepMs: 20 * MINUTE, interval: '5m' },
    { days: 3, stepMs: HOUR, interval: '1h' },
    { days: 7, stepMs: 2 * HOUR, interval: '1h' },
    { days: 14, stepMs: 4 * HOUR, interval: '1h' },
    { days: 30, stepMs: 12 * HOUR, interval: '1h' },
    { days: 365, stepMs: 5 * DAY, interval: '1d' },
  ])('when the window is $days days', ({ days, stepMs, interval }) => {
    it('picks the finest step that keeps the bars under the cap', () => {
      expect(histogramPlan(lastDays(days))).toEqual({ stepMs, interval });
    });
  });

  describe('when an hour step would ask the server for more than 1000 buckets', () => {
    it('falls back to daily buckets', () => {
      expect(histogramPlan(lastDays(45))).toEqual({ stepMs: DAY, interval: '1d' });
    });
  });

  describe.each([15 * MINUTE, 2 * HOUR, 13 * HOUR, 2 * DAY, 10 * DAY, 45 * DAY, 200 * DAY])(
    'when the window spans %i ms',
    span => {
      const timeRange = range(new Date(Date.UTC(2026, 9, 21) - span), new Date(Date.UTC(2026, 9, 21, 0, 7)));

      it(`never draws more than ${MAX_HISTOGRAM_BARS} bars`, () => {
        expect(bucketCountRows([], timeRange).length).toBeLessThanOrEqual(MAX_HISTOGRAM_BARS);
      });

      it('stays within the server bucket cap', () => {
        expect(apiBuckets(timeRange, histogramPlan(timeRange).interval)).toBeLessThanOrEqual(1000);
      });
    },
  );
});

describe('bucketCountRows', () => {
  describe.each(['America/New_York', 'Asia/Tokyo', 'Asia/Kolkata'])('when the browser is in %s', timeZone => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = timeZone;
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
    const sevenDays = () => range(at(14, 0), at(21, 0));

    describe('when the window is 7 days', () => {
      it('merges hourly rows into 2h buckets', () => {
        const buckets = bucketCountRows(
          [
            { bucket: at(14, 0).toISOString(), measures: { count: 3, errorCount: 1 } },
            { bucket: at(14, 1).toISOString(), measures: { count: 4, errorCount: 0 } },
            { bucket: at(14, 3).toISOString(), measures: { count: 2, errorCount: 2 } },
          ],
          sevenDays(),
        );

        expect(buckets).toHaveLength(84);
        expect(buckets[0]).toMatchObject({ ts: at(14, 0).getTime(), ok: 6, errors: 1 });
        expect(buckets[1]).toMatchObject({ ts: at(14, 2).getTime(), ok: 0, errors: 2 });
      });
    });

    describe('when the window is a day', () => {
      const oneDay = () => range(at(20, 9, 37), at(21, 9, 37));

      it('merges 5-minute rows into 20-minute buckets aligned on the local clock', () => {
        const buckets = bucketCountRows(
          [
            { bucket: at(20, 10, 0).toISOString(), measures: { count: 1, errorCount: 0 } },
            { bucket: at(20, 10, 15).toISOString(), measures: { count: 2, errorCount: 1 } },
          ],
          oneDay(),
        );

        expect(buckets[0]).toMatchObject({ ts: at(20, 9, 20).getTime() });
        expect(buckets.find(bucket => bucket.ts === at(20, 10, 0).getTime())).toMatchObject({ ok: 2, errors: 1 });
      });

      it('labels buckets with their minutes, and round hours without', () => {
        const buckets = bucketCountRows([], oneDay());

        expect(buckets.find(bucket => bucket.ts === at(20, 14, 20).getTime())).toMatchObject({
          label: '2:20 PM',
          time: 'Oct 20, 2:20 PM',
        });
        expect(buckets.find(bucket => bucket.ts === at(20, 14, 0).getTime())?.label).toBe('2 PM');
      });
    });

    describe('when a period has no rows', () => {
      it('keeps a zero bucket', () => {
        const buckets = bucketCountRows(
          [{ bucket: at(20, 13).toISOString(), measures: { count: 1, errorCount: 0 } }],
          sevenDays(),
        );

        expect(buckets[2]).toMatchObject({ ts: at(14, 4).getTime(), ok: 0, errors: 0 });
      });
    });

    describe('when errorCount is null', () => {
      it('counts it as 0', () => {
        const buckets = bucketCountRows(
          [{ bucket: at(14, 1).toISOString(), measures: { count: 5, errorCount: null } }],
          sevenDays(),
        );

        expect(buckets[0]).toMatchObject({ ok: 5, errors: 0 });
      });
    });

    describe('when a row has no bucket', () => {
      it('ignores it', () => {
        const buckets = bucketCountRows([{ measures: { count: 9, errorCount: 9 } }], sevenDays());

        expect(buckets.every(bucket => bucket.ok === 0 && bucket.errors === 0)).toBe(true);
      });
    });
  });
});

describe('exceedsAggregateWindow', () => {
  const end = new Date(Date.UTC(2026, 9, 21));

  describe('when the window is 365 days', () => {
    it('stays within the server limit', () => {
      expect(exceedsAggregateWindow(range(new Date(end.getTime() - 365 * DAY), end))).toBe(false);
    });
  });

  describe('when the window is 366 days', () => {
    it('exceeds the server limit', () => {
      expect(exceedsAggregateWindow(range(new Date(end.getTime() - 366 * DAY), end))).toBe(true);
    });
  });
});
