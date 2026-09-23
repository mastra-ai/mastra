import type { UISpan } from '../types';

export type SpanTimingLayout = {
  /** Milliseconds between the trace start and the span start. */
  startShiftMs: number;
  /** Horizontal offset of the span bar, as a percentage of the trace duration. */
  leftPercent: number;
  /** Width of the span bar, as a percentage of the trace duration, clamped to the remaining track. */
  widthPercent: number;
};

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
