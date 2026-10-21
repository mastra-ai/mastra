import { clockTime, dayHeading, startOfLocalDay } from '../../../../activity';
import { formatDuration } from '../../../../../../../lib/date/formatDuration';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const MIN_SPAN_MS = 5 * MINUTE_MS;
export const MAX_SPAN_MS = 7 * DAY_MS;

export type TimeViewport = { live: true; spanMs: number } | { live: false; spanMs: number; endMs: number };

export const LIVE_HOUR: TimeViewport = { live: true, spanMs: HOUR_MS };

export interface TimeWindow {
  startMs: number;
  endMs: number;
  endsAtNow: boolean;
}

export interface AxisTick {
  atMs: number;
  label: string;
}

const TICK_STEPS_MS = [
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
];
const MAX_TICKS = 6;
// Labels this close to an edge would collide with the edge's own label.
const EDGE_CLEARANCE_FRACTION = 0.04;
const ZOOM_STEP = 2;
const KEY_PAN_FRACTION = 0.25;

export function viewportWindow(viewport: TimeViewport, nowMs: number): TimeWindow {
  const endMs = viewport.live ? nowMs : Math.min(viewport.endMs, nowMs);
  return { startMs: endMs - viewport.spanMs, endMs, endsAtNow: endMs === nowMs };
}

export function windowPercent(atMs: number, timeWindow: TimeWindow): number {
  return ((atMs - timeWindow.startMs) / (timeWindow.endMs - timeWindow.startMs)) * 100;
}

function clampSpan(spanMs: number): number {
  return Math.min(MAX_SPAN_MS, Math.max(MIN_SPAN_MS, spanMs));
}

function settle(spanMs: number, endMs: number, nowMs: number): TimeViewport {
  return endMs >= nowMs ? { live: true, spanMs } : { live: false, spanMs, endMs };
}

export function zoomViewport(
  viewport: TimeViewport,
  scale: number,
  anchorFraction: number,
  nowMs: number,
): TimeViewport {
  const spanMs = clampSpan(viewport.spanMs * scale);
  const anchorMs = viewportWindow(viewport, nowMs).startMs + anchorFraction * viewport.spanMs;
  return settle(spanMs, Math.min(nowMs, anchorMs + (1 - anchorFraction) * spanMs), nowMs);
}

export function panViewport(viewport: TimeViewport, spanFraction: number, nowMs: number): TimeViewport {
  const { endMs } = viewportWindow(viewport, nowMs);
  return settle(viewport.spanMs, Math.min(nowMs, endMs + spanFraction * viewport.spanMs), nowMs);
}

function buttonZoomAnchor(viewport: TimeViewport): number {
  return viewport.live ? 1 : 0.5;
}

export function zoomIn(viewport: TimeViewport, nowMs: number): TimeViewport {
  return zoomViewport(viewport, 1 / ZOOM_STEP, buttonZoomAnchor(viewport), nowMs);
}

export function zoomOut(viewport: TimeViewport, nowMs: number): TimeViewport {
  return zoomViewport(viewport, ZOOM_STEP, buttonZoomAnchor(viewport), nowMs);
}

export function followNow(viewport: TimeViewport): TimeViewport {
  return { live: true, spanMs: viewport.spanMs };
}

export const VIEWPORT_KEY_ACTIONS: Partial<Record<string, (viewport: TimeViewport, nowMs: number) => TimeViewport>> = {
  ArrowLeft: (viewport, nowMs) => panViewport(viewport, -KEY_PAN_FRACTION, nowMs),
  ArrowRight: (viewport, nowMs) => panViewport(viewport, KEY_PAN_FRACTION, nowMs),
  '+': zoomIn,
  '=': zoomIn,
  '-': zoomOut,
  End: followNow,
};

function tickStep(spanMs: number): number {
  return TICK_STEPS_MS.find(step => spanMs / step <= MAX_TICKS) ?? DAY_MS;
}

function clearOfEdges(atMs: number, timeWindow: TimeWindow): boolean {
  const fraction = windowPercent(atMs, timeWindow) / 100;
  return fraction > EDGE_CLEARANCE_FRACTION && fraction < 1 - EDGE_CLEARANCE_FRACTION;
}

function localTicksMs(timeWindow: TimeWindow, stepMs: number): number[] {
  const ticksMs: number[] = [];
  if (stepMs < HOUR_MS) {
    const hourStart = new Date(timeWindow.startMs);
    hourStart.setMinutes(0, 0, 0);
    for (let atMs = hourStart.getTime(); atMs < timeWindow.endMs; atMs += stepMs) {
      if (atMs >= timeWindow.startMs) ticksMs.push(atMs);
    }
    return ticksMs;
  }
  const day = new Date(startOfLocalDay(timeWindow.startMs));
  const stepHours = stepMs / HOUR_MS;
  for (let hours = 0; ; hours += stepHours) {
    const atMs = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours).getTime();
    if (atMs >= timeWindow.endMs) return ticksMs;
    if (atMs >= timeWindow.startMs && atMs !== ticksMs.at(-1)) ticksMs.push(atMs);
  }
}

export function axisTicks(viewport: TimeViewport, timeWindow: TimeWindow, nowMs: number): AxisTick[] {
  const stepMs = tickStep(viewport.spanMs);

  if (viewport.live) {
    const ticks: AxisTick[] = [];
    for (let agoMs = stepMs; timeWindow.endMs - agoMs > timeWindow.startMs; agoMs += stepMs) {
      ticks.push({ atMs: timeWindow.endMs - agoMs, label: `−${formatDuration(agoMs)}` });
    }
    return ticks.filter(tick => clearOfEdges(tick.atMs, timeWindow));
  }

  return localTicksMs(timeWindow, stepMs)
    .filter(atMs => clearOfEdges(atMs, timeWindow))
    .map(atMs => ({ atMs, label: startOfLocalDay(atMs) === atMs ? dayHeading(atMs, nowMs) : clockTime(atMs) }));
}

export function viewedDayLabel(viewport: TimeViewport, timeWindow: TimeWindow, nowMs: number): string | undefined {
  if (viewport.live) return undefined;
  const viewedDay = startOfLocalDay(timeWindow.startMs);
  return viewedDay === startOfLocalDay(nowMs) ? undefined : dayHeading(viewedDay, nowMs);
}
