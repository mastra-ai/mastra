type Timestamp = Date | string;

type SnapshotSpan = {
  startedAt: Timestamp;
  endedAt?: Timestamp | null;
  output?: unknown;
  error?: unknown;
};

const toMs = (value: Timestamp) => new Date(value).getTime();

/**
 * The spans as they were at `t` (epoch ms): spans that had not started yet are dropped, spans still
 * running lose their end, output and error so downstream formatters render them as in progress.
 * Spans that had already ended are returned as-is.
 */
export function snapshotSpansAt<S extends SnapshotSpan>(spans: S[], t: number): S[] {
  return spans.flatMap(span => {
    if (toMs(span.startedAt) > t) return [];
    if (span.endedAt && toMs(span.endedAt) <= t) return [span];
    return [{ ...span, endedAt: null, output: undefined, error: undefined }];
  });
}

export type SpanSnapshotIndex = {
  /** Start times, ascending. */
  starts: number[];
  /** End times of the spans that ended, ascending. */
  ends: number[];
};

export function createSpanSnapshotIndex(spans: SnapshotSpan[]): SpanSnapshotIndex {
  const starts = spans.map(span => toMs(span.startedAt)).sort((a, b) => a - b);
  const ends = spans.flatMap(span => (span.endedAt ? [toMs(span.endedAt)] : [])).sort((a, b) => a - b);
  return { starts, ends };
}

/** Number of values in the ascending `sorted` that are `<= value`. */
function countAtOrBefore(sorted: number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((sorted[mid] ?? Infinity) <= value) low = mid + 1;
    else high = mid;
  }
  return low;
}

/** Identifies the snapshot at `t`: it only changes when `t` crosses a span start or end. */
export function snapshotKeyAt(index: SpanSnapshotIndex, t: number): string {
  return `${countAtOrBefore(index.starts, t)}:${countAtOrBefore(index.ends, t)}`;
}

/** Every distinct span start and end, ascending: the points the cursor steps between. */
export function getTimelineEvents(spans: { startTime: string; latency: number; endTime?: string }[]): number[] {
  const events = new Set<number>();
  for (const span of spans) {
    const start = toMs(span.startTime);
    events.add(start);
    if (span.endTime) events.add(start + span.latency);
  }
  return [...events].sort((a, b) => a - b);
}
