/**
 * Time buckets for the Metrics charts. The observability API answers in 1h or 1d buckets; bar
 * charts merge them into ~24-30 bars per range (24h 1h, 3d 3h, 7d 6h, 14d 12h, 30d 1d) so the
 * bars stay readable. Sums merge exactly. Latency percentiles can't be merged, so the latency
 * chart keeps the API's own buckets (a line stays readable with more points).
 */
import type { BucketLabels } from './bucket-labels';
import { bucketLabels, isMultiDay } from './bucket-labels';

export type { BucketLabels };

export type ApiInterval = '1h' | '1d';

export type BucketPlan = {
  /** The interval the API is asked for. */
  interval: ApiInterval;
  /** Hours per chart bucket: a multiple of the API interval. */
  stepHours: number;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A little slack so a preset's window (e.g. "last 7 days" ending now) still picks its plan. */
const SLACK = HOUR;

export function bucketPlan(start: Date, end: Date): BucketPlan {
  const span = end.getTime() - start.getTime();
  if (span <= DAY + SLACK) return { interval: '1h', stepHours: 1 };
  if (span <= 3 * DAY + SLACK) return { interval: '1h', stepHours: 3 };
  if (span <= 7 * DAY + SLACK) return { interval: '1h', stepHours: 6 };
  if (span <= 14 * DAY + SLACK) return { interval: '1h', stepHours: 12 };
  return { interval: '1d', stepHours: 24 };
}

/** Hours per bucket of the API's own interval: the latency chart keeps these. */
export const intervalHours = (interval: ApiInterval) => (interval === '1h' ? 1 : 24);

/** The start of the local bucket holding `ms`: whole local hours, step-aligned from midnight. */
export function bucketStart(ms: number, stepHours: number) {
  const d = new Date(ms);
  if (stepHours >= 24) return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hour = Math.floor(d.getHours() / stepHours) * stepHours;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime();
}

/** The next bucket's start, stepping in local time so a DST change doesn't drift the grid. */
export function nextBucket(ms: number, stepHours: number) {
  const d = new Date(ms);
  if (stepHours >= 24) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return bucketStart(
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + stepHours).getTime(),
    stepHours,
  );
}

/** Every bucket in the window, so quiet periods show as zero instead of disappearing. */
export function bucketGrid(start: Date, end: Date, stepHours: number): BucketLabels[] {
  const multiDay = isMultiDay(start, end);
  const out: BucketLabels[] = [];
  for (let ts = bucketStart(start.getTime(), stepHours); ts <= end.getTime(); ts = nextBucket(ts, stepHours)) {
    out.push(bucketLabels(ts, stepHours, multiDay));
  }
  return out;
}

export type Point = { timestamp: string | Date; value: number; estimatedCost?: number | null };

/** Index of a grid by bucket start, for adding API points into their bucket. */
export function gridIndex(grid: BucketLabels[], stepHours: number) {
  const index = new Map(grid.map((b, i) => [b.ts, i]));
  return (point: Point) => index.get(bucketStart(new Date(point.timestamp).getTime(), stepHours));
}

/** The window a bucket covers, for drilling into its traces. */
export function bucketWindow(ts: number, stepHours: number) {
  return { from: new Date(ts), to: new Date(nextBucket(ts, stepHours)) };
}
