import type { UISpan } from '../types';

export type SpanTimingLayout = {
  /** Milliseconds between the trace start and the span start. */
  startShiftMs: number;
  /** Horizontal offset of the span bar, as a percentage of the trace duration. */
  leftPercent: number;
  /** Width of the span bar, as a percentage of the trace duration, clamped to the remaining track. */
  widthPercent: number;
};

type TimedSpan = { startTime: string; endTime?: string; spans?: TimedSpan[] };

/**
 * Time axis of a span tree: from the earliest top-level start to the latest end anywhere
 * in the tree, so every root (not only the first one) fits on it.
 */
export function getTraceTimeRange(spans: TimedSpan[]): { startTime: string; latency: number } {
  const start = Math.min(...spans.map(span => new Date(span.startTime).getTime()));
  if (!Number.isFinite(start)) return { startTime: '', latency: 0 };

  let end = start;
  const visit = (list: TimedSpan[]) => {
    for (const span of list) {
      if (span.endTime) end = Math.max(end, new Date(span.endTime).getTime());
      if (span.spans) visit(span.spans);
    }
  };
  visit(spans);

  return { startTime: new Date(start).toISOString(), latency: end - start };
}

/** Positions a span on a track spanning the whole trace (`overallLatency` ms from `overallStartTime`). */
export function getSpanTimingLayout(
  span: UISpan,
  overallLatency?: number,
  overallStartTime?: string,
): SpanTimingLayout {
  const overallStart = overallStartTime ? new Date(overallStartTime).getTime() : NaN;
  const spanStart = span.startTime ? new Date(span.startTime).getTime() : NaN;
  const startShiftMs = Number.isNaN(overallStart) || Number.isNaN(spanStart) ? 0 : spanStart - overallStart;

  if (!overallLatency) return { startShiftMs, leftPercent: 0, widthPercent: 0 };

  const leftPercent = Math.min(100, Math.max(0, Math.floor((startShiftMs / overallLatency) * 100)));
  const widthPercent = Math.min(100 - leftPercent, Math.ceil((span.latency / overallLatency) * 100));

  return { startShiftMs, leftPercent, widthPercent };
}
