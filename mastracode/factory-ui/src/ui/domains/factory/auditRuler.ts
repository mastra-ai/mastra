import { clamp, type AuditTimeRange } from './auditPresentation';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const COARSEST_STEP = 364 * DAY;
// Past two days every step is a multiple of a week, so a coarse major tick always lands on a minor one.
const RULER_STEPS = [
  5 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  28 * DAY,
  91 * DAY,
  COARSEST_STEP,
];
const MINIMUM_SPAN = MINUTE;

export type AuditBoundary = 'from' | 'to';

// The chart's gridlines and the ruler's day labels are one axis: same budget, same ticks.
export const AUDIT_AXIS_TICKS = 6;

// Epoch multiples land on UTC boundaries; shifting by the zone offset puts ticks
// on local midnights and round local hours instead.
function localShift(at: number): number {
  return new Date(at).getTimezoneOffset() * MINUTE;
}

// The offset is read at each tick, so a daylight-saving change re-anchors the
// rest of the ruler instead of dragging every later tick an hour off the hour.
function alignedTick(at: number, step: number, toWhole: (value: number) => number): number {
  const shift = localShift(at);
  return toWhole((at - shift) / step) * step + shift;
}

export function auditRulerStep(span: number, maximumTicks: number): number {
  return RULER_STEPS.find(step => span / step <= maximumTicks) ?? COARSEST_STEP;
}

export function auditRulerTicks(bounds: AuditTimeRange, step: number): number[] {
  const ticks: number[] = [];
  for (
    let at = alignedTick(bounds.from, step, Math.ceil);
    at <= bounds.to;
    at = alignedTick(at + step, step, Math.round)
  )
    ticks.push(at);
  return ticks;
}

export function auditRangeWithBoundary(
  range: AuditTimeRange,
  boundary: AuditBoundary,
  at: number,
  bounds: AuditTimeRange,
): AuditTimeRange {
  const minimumSpan = Math.min(MINIMUM_SPAN, bounds.to - bounds.from);
  if (boundary === 'from') {
    return { from: clamp(at, bounds.from, Math.max(bounds.from, range.to - minimumSpan)), to: range.to };
  }
  return { from: range.from, to: clamp(at, Math.min(bounds.to, range.from + minimumSpan), bounds.to) };
}

export function auditRangeShifted(range: AuditTimeRange, delta: number, bounds: AuditTimeRange): AuditTimeRange {
  const span = range.to - range.from;
  const from = clamp(range.from + delta, bounds.from, bounds.to - span);
  return { from, to: from + span };
}

export function auditRangeUnlessFull(range: AuditTimeRange, bounds: AuditTimeRange): AuditTimeRange | undefined {
  return range.from <= bounds.from && range.to >= bounds.to ? undefined : range;
}
