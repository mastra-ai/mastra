import { clamp } from './date-range-timeline';
import type { DateBoundary, TimelineIndexRange } from './date-range-timeline';

interface TimelineTrackGeometry {
  left: number;
  width: number;
}

export type TimelinePointerGesture =
  | { type: 'brush'; startIndex: number }
  | { type: 'pan'; startIndex: number; originalSelection: TimelineIndexRange }
  | { type: 'handle'; boundary: DateBoundary; originalSelection: TimelineIndexRange };

export type TimelineInteraction =
  | { type: 'selecting' }
  | { type: 'moving' }
  | { type: 'resizing'; boundary: DateBoundary };

const KEYBOARD_LARGE_STEP_DAYS = 7;

function getKeyboardDelta(key: string) {
  if (key === 'ArrowLeft' || key === 'ArrowDown') return -1;
  if (key === 'ArrowRight' || key === 'ArrowUp') return 1;
  if (key === 'PageDown') return -KEYBOARD_LARGE_STEP_DAYS;
  if (key === 'PageUp') return KEYBOARD_LARGE_STEP_DAYS;
  return undefined;
}

export function getTimelineInteraction(gesture: TimelinePointerGesture): TimelineInteraction {
  if (gesture.type === 'brush') return { type: 'selecting' };
  if (gesture.type === 'pan') return { type: 'moving' };
  return { type: 'resizing', boundary: gesture.boundary };
}

export function getTimelineIndexAtClientX(
  clientX: number,
  track: TimelineTrackGeometry | undefined,
  viewport: TimelineIndexRange,
) {
  const viewportSpan = viewport.to - viewport.from;
  if (!track || track.width <= 0 || viewportSpan <= 0) return viewport.from;

  const position = clamp((clientX - track.left) / track.width, 0, 1);
  return viewport.from + Math.round(position * viewportSpan);
}

export function resolveTimelineGestureSelection(
  gesture: TimelinePointerGesture,
  pointerIndex: number,
  viewport: TimelineIndexRange,
): TimelineIndexRange {
  const boundedPointerIndex = clamp(pointerIndex, viewport.from, viewport.to);

  if (gesture.type === 'brush') {
    return {
      from: Math.min(gesture.startIndex, boundedPointerIndex),
      to: Math.max(gesture.startIndex, boundedPointerIndex),
    };
  }

  if (gesture.type === 'pan') {
    const selectionSpan = gesture.originalSelection.to - gesture.originalSelection.from;
    const delta = boundedPointerIndex - gesture.startIndex;
    const from = clamp(gesture.originalSelection.from + delta, viewport.from, viewport.to - selectionSpan);
    return { from, to: from + selectionSpan };
  }

  if (gesture.boundary === 'from') {
    return {
      from: clamp(boundedPointerIndex, viewport.from, gesture.originalSelection.to),
      to: gesture.originalSelection.to,
    };
  }

  return {
    from: gesture.originalSelection.from,
    to: clamp(boundedPointerIndex, gesture.originalSelection.from, viewport.to),
  };
}

export function moveTimelineSelectionFromKey(selection: TimelineIndexRange, key: string, maximumIndex: number) {
  const span = selection.to - selection.from;
  if (key === 'Home') return { from: 0, to: span };
  if (key === 'End') return { from: maximumIndex - span, to: maximumIndex };

  const delta = getKeyboardDelta(key);
  if (delta === undefined) return undefined;
  const from = clamp(selection.from + delta, 0, maximumIndex - span);
  return { from, to: from + span };
}

export function resizeTimelineSelectionFromKey(
  selection: TimelineIndexRange,
  boundary: DateBoundary,
  key: string,
  maximumIndex: number,
) {
  const { from, to } = selection;
  if (key === 'Home') return boundary === 'from' ? { from: 0, to } : { from, to: from };
  if (key === 'End') {
    return boundary === 'from' ? { from: to, to } : { from, to: maximumIndex };
  }

  const delta = getKeyboardDelta(key);
  if (delta === undefined) return undefined;
  return boundary === 'from'
    ? { from: clamp(from + delta, 0, to), to }
    : { from, to: clamp(to + delta, from, maximumIndex) };
}
