import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bucketCountRows,
  exceedsAggregateWindow,
  histogramPlan,
  MAX_HISTOGRAM_BARS,
  zoomWindow,
} from './histogram-buckets';

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

/** Runs `fn` with the browser in `timeZone`. */
const inTimeZone = (timeZone: string) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = timeZone;
  });
  afterAll(() => {
    process.env.TZ = original;
  });
};

/** One row per API bucket the server answers for the window (UTC-aligned), each with 2 spans, 1 failed. */
const serverRows = ({ from, to }: { from: string; to: string }, intervalMs: number) => {
  const rows = [];
  for (let ms = Math.floor(Date.parse(from) / intervalMs) * intervalMs; ms < Date.parse(to); ms += intervalMs) {
    rows.push({ bucket: new Date(ms).toISOString(), measures: { count: 2, errorCount: 1 } });
  }
  return rows;
};

const utc = (iso: string) => Date.parse(`${iso}Z`);

describe('bucketCountRows', () => {
  describe.each(['UTC', 'Europe/Paris', 'America/New_York', 'Asia/Tokyo', 'Asia/Kolkata', 'Asia/Kathmandu'])(
    'when the browser is in %s',
    timeZone => {
      inTimeZone(timeZone);

      // Local midnights, like a date picked in the browser. Paris and New York each cross a DST change.
      describe.each([
        { name: 'a 7-day window', from: [2026, 9, 22], to: [2026, 9, 29], intervalMs: HOUR },
        { name: 'a 7-day window', from: [2026, 9, 28], to: [2026, 10, 4], intervalMs: HOUR },
        { name: 'a 1-day window', from: [2026, 5, 1, 9, 37], to: [2026, 5, 2, 9, 37], intervalMs: 5 * MINUTE },
      ])('over $name from $from', ({ from, to, intervalMs }) => {
        const window = () => range(new Date(...(from as [number, number])), new Date(...(to as [number, number])));

        it('keeps every count and error the server sends', () => {
          const rows = serverRows(window(), intervalMs);
          const buckets = bucketCountRows(rows, window());

          expect(buckets.reduce((sum, bucket) => sum + bucket.ok, 0)).toBe(rows.length);
          expect(buckets.reduce((sum, bucket) => sum + bucket.errors, 0)).toBe(rows.length);
        });

        it('starts every bar on a UTC step', () => {
          const { stepMs } = histogramPlan(window());
          for (const bucket of bucketCountRows([], window())) expect(bucket.ts % stepMs).toBe(0);
        });

        it('zooms onto API bucket edges', () => {
          const { from: zoomFrom, to: zoomTo } = zoomWindow(
            bucketCountRows([], window()),
            { start: 10, end: 20 },
            window(),
          );

          expect(zoomFrom.getTime() % intervalMs).toBe(0);
          expect(zoomTo.getTime() % intervalMs).toBe(0);
        });
      });

      describe('when the window is 7 days', () => {
        const sevenDays = () => range(new Date(utc('2026-10-14T00:00')), new Date(utc('2026-10-21T00:00')));

        it('merges hourly rows into 2h bars', () => {
          const buckets = bucketCountRows(
            [
              { bucket: '2026-10-14T00:00:00.000Z', measures: { count: 3, errorCount: 1 } },
              { bucket: '2026-10-14T01:00:00.000Z', measures: { count: 4, errorCount: 0 } },
              { bucket: '2026-10-14T03:00:00.000Z', measures: { count: 2, errorCount: 2 } },
            ],
            sevenDays(),
          );

          expect(buckets).toHaveLength(84);
          expect(buckets[0]).toMatchObject({ ts: utc('2026-10-14T00:00'), ok: 6, errors: 1 });
          expect(buckets[1]).toMatchObject({ ts: utc('2026-10-14T02:00'), ok: 0, errors: 2 });
          expect(buckets[2]).toMatchObject({ ts: utc('2026-10-14T04:00'), ok: 0, errors: 0 });
        });

        it('counts a null errorCount as 0', () => {
          const buckets = bucketCountRows(
            [{ bucket: '2026-10-14T01:00:00.000Z', measures: { count: 5, errorCount: null } }],
            sevenDays(),
          );

          expect(buckets[0]).toMatchObject({ ok: 5, errors: 0 });
        });

        it('ignores a row without a bucket', () => {
          const buckets = bucketCountRows([{ measures: { count: 9, errorCount: 9 } }], sevenDays());

          expect(buckets.every(bucket => bucket.ok === 0 && bucket.errors === 0)).toBe(true);
        });
      });
    },
  );

  describe('labels', () => {
    describe('when the browser is in Paris', () => {
      inTimeZone('Europe/Paris');

      it('shows each bar in local time, with minutes only when it has some', () => {
        // Oct 20 is UTC+2 in Paris: 12:20Z is 2:20 PM.
        const buckets = bucketCountRows(
          [],
          range(new Date(utc('2026-10-20T07:37')), new Date(utc('2026-10-21T07:37'))),
        );

        expect(buckets.find(bucket => bucket.ts === utc('2026-10-20T12:20'))).toMatchObject({
          label: '2:20 PM',
          time: 'Oct 20, 2:20 PM',
        });
        expect(buckets.find(bucket => bucket.ts === utc('2026-10-20T12:00'))?.label).toBe('2 PM');
      });

      it('names the day on its first bar', () => {
        const buckets = bucketCountRows([], range(new Date(2026, 9, 14), new Date(2026, 9, 21)));

        // 22:00Z is midnight on Oct 16 in Paris.
        expect(buckets.find(bucket => bucket.ts === utc('2026-10-15T22:00'))?.label).toBe('Oct 16');
        expect(buckets.find(bucket => bucket.ts === utc('2026-10-16T00:00'))?.label).toBe('Oct 16, 2 AM');
      });
    });

    describe('when the browser is in Kolkata', () => {
      inTimeZone('Asia/Kolkata');

      it('keeps the half hour in the labels', () => {
        const buckets = bucketCountRows([], range(new Date(2026, 5, 1), new Date(2026, 5, 8)));
        const bar = buckets.find(bucket => bucket.ts === utc('2026-06-02T08:00'));

        expect(bar).toMatchObject({ label: 'Jun 2, 1:30 PM', time: 'Jun 2, 1:30 PM' });
        // 18:00Z is 11:30 PM; 20:00Z, 1:30 AM, is the first bar of Jun 3.
        expect(buckets.find(bucket => bucket.ts === utc('2026-06-02T18:00'))?.label).toBe('Jun 2, 11:30 PM');
        expect(buckets.find(bucket => bucket.ts === utc('2026-06-02T20:00'))?.label).toBe('Jun 3');
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

describe('zoomWindow', () => {
  // A rolling 7-day window that doesn't start on a bar boundary: 2h bars, the first one partial.
  const window = lastDays(7);
  const buckets = bucketCountRows([], window);
  const barStart = (index: number) => {
    const bucket = buckets[index];
    if (!bucket) throw new Error(`no bar ${index}`);
    return bucket.ts;
  };

  it('spans from the start of the first selected bar to the start of the bar after the last', () => {
    expect(zoomWindow(buckets, { start: 3, end: 5 }, window)).toEqual({
      from: new Date(barStart(3)),
      to: new Date(barStart(6)),
    });
  });

  it('starts at the window start when the first bar is only partly inside it', () => {
    expect(barStart(0)).toBeLessThan(Date.parse(window.from));
    expect(zoomWindow(buckets, { start: 0, end: 1 }, window).from).toEqual(new Date(window.from));
  });

  it('ends at the window end when the selection reaches the last bar', () => {
    expect(zoomWindow(buckets, { start: buckets.length - 2, end: buckets.length - 1 }, window).to).toEqual(
      new Date(window.to),
    );
  });
});
