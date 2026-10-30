import type { UISpan } from '../types';

/** Streaming timings of the trace root, read from its listed row. */
export type TraceStreamingTimings = {
  /** When the root span started; both timings count from a point on its run. */
  startedAt: string | Date;
  timeToFirstChunkMs?: number | null;
  timeToFirstTokenMs?: number | null;
};

/** Where the markers sit on the track, as percentages of the trace duration. */
export type TimelineMarkersLayout = {
  timeToFirstChunkMs: number;
  firstChunkPercent: number;
  /** The model's own wait: from the inference start up to the first chunk. */
  firstToken?: { timeToFirstTokenMs: number; leftPercent: number; widthPercent: number };
};

const clampPercent = (percent: number) => Math.min(100, Math.max(0, percent));

/**
 * TTFC counts from the root start and TTFT from the inference start, but both end on the first
 * chunk. So TTFC is a point on the axis, and TTFT the stretch of track leading up to it.
 */
export function getTimelineMarkersLayout(
  spans: Pick<UISpan, 'startTime'>[],
  overallLatency: number,
  timings?: TraceStreamingTimings,
): TimelineMarkersLayout | undefined {
  const timeToFirstChunkMs = timings?.timeToFirstChunkMs;
  const overallStartTime = spans[0]?.startTime;
  if (!timings || timeToFirstChunkMs == null || !overallLatency || !overallStartTime) return undefined;

  const rootShiftMs = new Date(timings.startedAt).getTime() - new Date(overallStartTime).getTime();
  if (Number.isNaN(rootShiftMs)) return undefined;

  const toPercent = (ms: number) => clampPercent(((rootShiftMs + ms) * 100) / overallLatency);
  const firstChunkPercent = toPercent(timeToFirstChunkMs);
  const timeToFirstTokenMs = timings.timeToFirstTokenMs;
  if (timeToFirstTokenMs == null) return { timeToFirstChunkMs, firstChunkPercent };

  // The inference cannot start before the root, even if the recorded timings disagree.
  const leftPercent = toPercent(Math.max(0, timeToFirstChunkMs - timeToFirstTokenMs));
  return {
    timeToFirstChunkMs,
    firstChunkPercent,
    firstToken: { timeToFirstTokenMs, leftPercent, widthPercent: firstChunkPercent - leftPercent },
  };
}
