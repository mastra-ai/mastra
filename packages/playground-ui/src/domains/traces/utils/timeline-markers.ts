import type { UISpan } from '../types';

/** Streaming timings of the trace root, read from its listed row. */
export type TraceStreamingTimings = {
  /** When the root span started; both timings count from a point on its run. */
  startedAt: string | Date;
  timeToFirstChunkMs?: number | null;
  timeToFirstTokenMs?: number | null;
};

/** A timing drawn as a bar on the track, as percentages of the trace duration. */
export type TimelineTimingBar = { durationMs: number; leftPercent: number; widthPercent: number };

export type TimelineMarkersLayout = {
  /** From the root start up to the first chunk. */
  firstChunk: TimelineTimingBar;
  /** The model's own wait: from the inference start up to the first chunk. */
  firstToken?: TimelineTimingBar;
};

const clampPercent = (percent: number) => Math.min(100, Math.max(0, percent));

/**
 * TTFC counts from the root start and TTFT from the inference start, but both end on the first
 * chunk. So both are bars ending on the same point of the axis, starting at different places.
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
  const barFrom = (startMs: number, durationMs: number): TimelineTimingBar => {
    const leftPercent = toPercent(startMs);
    return { durationMs, leftPercent, widthPercent: firstChunkPercent - leftPercent };
  };

  const firstChunk = barFrom(0, timeToFirstChunkMs);
  const timeToFirstTokenMs = timings.timeToFirstTokenMs;
  if (timeToFirstTokenMs == null) return { firstChunk };

  // The inference cannot start before the root, even if the recorded timings disagree.
  const firstToken = barFrom(Math.max(0, timeToFirstChunkMs - timeToFirstTokenMs), timeToFirstTokenMs);
  return { firstChunk, firstToken };
}
