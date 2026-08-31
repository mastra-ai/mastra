import { clamp, type AuditTimeRange } from './auditPresentation';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const COARSEST_STEP = 7 * DAY;
const RULER_STEPS = [5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY];
const MINIMUM_SPAN = MINUTE;

export type AuditBoundary = 'from' | 'to';

// The chart's gridlines and the ruler's day labels are one axis: same budget, same ticks.
export const AUDIT_AXIS_TICKS = 6;

// Epoch multiples land on UTC boundaries; shifting by the zone offset puts ticks
// on local midnights and round local hours instead.
function localShift(at: number): number {
  return new Date(at).getTimezoneOffset() * MINUTE;
}

export function auditRulerStep(span: number, maximumTicks: number): number {
  return RULER_STEPS.find(step => span / step <= maximumTicks) ?? COARSEST_STEP;
}

export function auditRulerTicks(bounds: AuditTimeRange, step: number): number[] {
  const shift = localShift(bounds.from);
  const ticks: number[] = [];
  for (let at = Math.ceil((bounds.from - shift) / step) * step + shift; at <= bounds.to; at += step) ticks.push(at);
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
