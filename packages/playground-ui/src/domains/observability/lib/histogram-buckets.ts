/**
 * Buckets for the Traces and Spans histograms: up to `MAX_HISTOGRAM_BARS` thin bars over the list's
 * window. `count` and `errorCount` are sums, so the API's buckets merge exactly into each bar.
 */
import { bucketLabels, isMultiDay } from '@/domains/metrics/lib/bucket-labels';
import type { BucketLabels } from '@/domains/metrics/lib/bucket-labels';

type TimeRange = { from: string; to: string };

type CountRow = { bucket?: string; measures: { count?: number | null; errorCount?: number | null } };

export type HistogramBucket = BucketLabels & { ok: number; errors: number };

export type HistogramInterval = '1m' | '5m' | '15m' | '1h' | '1d';

export type HistogramPlan = {
  /** The interval the API is asked for. */
  interval: HistogramInterval;
  /** Milliseconds per bar: a multiple of the API interval. */
  stepMs: number;
};

export const HISTOGRAM_MEASURES = ['count', 'errorCount'] as const;

export const MAX_HISTOGRAM_BARS = 90;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Mirrors `TRACE_AGGREGATE_MAX_TIME_RANGE_DAYS` in `@mastra/core/storage` (trace-aggregate.ts), which isn't browser-safe to import. */
const MAX_TIME_RANGE_MS = 365 * DAY;
/** Mirrors `TRACE_AGGREGATE_MAX_BUCKETS` in `@mastra/core/storage` (trace-aggregate-planner.ts). */
const MAX_API_BUCKETS = 1000;

const INTERVAL_MS: Record<HistogramInterval, number> = {
  '1m': MINUTE,
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '1h': HOUR,
  '1d': DAY,
};

/** 365 days (the widest window) fits under the bar cap at this step. */
const COARSEST_STEP: HistogramPlan = { stepMs: 30 * DAY, interval: '1d' };

/** Round bar widths, finest first, each with the coarsest API interval that divides it. */
const STEPS: HistogramPlan[] = [
  { stepMs: MINUTE, interval: '1m' },
  { stepMs: 2 * MINUTE, interval: '1m' },
  { stepMs: 5 * MINUTE, interval: '5m' },
  { stepMs: 10 * MINUTE, interval: '5m' },
  { stepMs: 15 * MINUTE, interval: '15m' },
  { stepMs: 20 * MINUTE, interval: '5m' },
  { stepMs: 30 * MINUTE, interval: '15m' },
  ...[1, 2, 3, 4, 6, 8, 12].map(hours => ({ stepMs: hours * HOUR, interval: '1h' as const })),
  ...[1, 2, 3, 5, 7, 14].map(days => ({ stepMs: days * DAY, interval: '1d' as const })),
  COARSEST_STEP,
];

/** The server's bucket count for `[from, to)`: its buckets are UTC-aligned. */
const apiBuckets = (fromMs: number, toMs: number, intervalMs: number) =>
  Math.floor((toMs - 1) / intervalMs) - Math.floor(fromMs / intervalMs) + 1;

/** The finest step whose bars (an unaligned window touches one extra) and API buckets both fit. */
export function histogramPlan({ from, to }: TimeRange): HistogramPlan {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const span = Math.max(toMs - fromMs, 0);
  return (
    STEPS.find(
      ({ stepMs, interval }) =>
        Math.ceil(span / stepMs) + 1 <= MAX_HISTOGRAM_BARS &&
        apiBuckets(fromMs, toMs, INTERVAL_MS[interval]) <= MAX_API_BUCKETS,
    ) ?? COARSEST_STEP
  );
}

/** The server rejects aggregates over a wider window than this. */
export const exceedsAggregateWindow = ({ from, to }: TimeRange) =>
  Date.parse(to) - Date.parse(from) > MAX_TIME_RANGE_MS;

/**
 * The start of the bar holding `ms`, on the same UTC grid as the API's buckets: every bar holds
 * whole API buckets in any time zone. Only the labels are local.
 */
const barStart = (ms: number, stepMs: number) => Math.floor(ms / stepMs) * stepMs;

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtClock = (d: Date) =>
  d.toLocaleTimeString('en-US', d.getMinutes() === 0 ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' });

function barLabels(ts: number, stepMs: number, multiDay: boolean): BucketLabels {
  if (stepMs >= DAY) return bucketLabels(ts, stepMs / HOUR, multiDay);
  const d = new Date(ts);
  const edgeLabel = `${fmtDay(d)}, ${fmtClock(d)}`;
  if (!multiDay) return { ts, label: fmtClock(d), edgeLabel, time: edgeLabel };
  // The day's first bar, which off whole-hour zones starts just after local midnight.
  const firstOfDay = d.getHours() * 60 + d.getMinutes() < stepMs / MINUTE;
  return { ts, label: firstOfDay ? fmtDay(d) : edgeLabel, edgeLabel, time: edgeLabel };
}

/** Every bar of the window, quiet ones as zero, with non-error and error counts summed per bar. */
export function bucketCountRows(rows: CountRow[], timeRange: TimeRange): HistogramBucket[] {
  const { stepMs } = histogramPlan(timeRange);
  const start = new Date(timeRange.from);
  const end = new Date(timeRange.to);
  const multiDay = isMultiDay(start, end);
  const buckets: HistogramBucket[] = [];
  const index = new Map<number, HistogramBucket>();
  for (let ts = barStart(start.getTime(), stepMs); ts < end.getTime(); ts += stepMs) {
    const bucket = { ...barLabels(ts, stepMs, multiDay), ok: 0, errors: 0 };
    buckets.push(bucket);
    index.set(ts, bucket);
  }
  for (const row of rows) {
    if (!row.bucket) continue;
    const bucket = index.get(barStart(Date.parse(row.bucket), stepMs));
    if (!bucket) continue;
    const count = row.measures.count ?? 0;
    const errors = row.measures.errorCount ?? 0;
    bucket.ok += Math.max(count - errors, 0);
    bucket.errors += errors;
  }
  return buckets;
}

/**
 * The time span of the bars `start` to `end` (inclusive): from the first bar's start to the next
 * bar's start, kept inside `timeRange` since the edge bars can stick out of it.
 */
export function zoomWindow(
  buckets: HistogramBucket[],
  { start, end }: { start: number; end: number },
  timeRange: TimeRange,
): { from: Date; to: Date } {
  const fromMs = Date.parse(timeRange.from);
  const toMs = Date.parse(timeRange.to);
  const first = buckets[start]?.ts ?? fromMs;
  const after = buckets[end + 1]?.ts ?? toMs;
  return { from: new Date(Math.max(first, fromMs)), to: new Date(Math.min(after, toMs)) };
}
