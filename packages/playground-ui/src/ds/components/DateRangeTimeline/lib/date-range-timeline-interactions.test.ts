import { describe, expect, it } from 'vitest';
import {
  getTimelineInteraction,
  getTimelineIndexAtClientX,
  moveTimelineSelectionFromKey,
  resizeTimelineSelectionFromKey,
  resolveTimelineGestureSelection,
} from './date-range-timeline-interactions';
import type { TimelinePointerGesture } from './date-range-timeline-interactions';

const VIEWPORT = { from: 10, to: 40 };

describe('date range timeline interactions', () => {
  it('maps and clamps a pointer coordinate to the visible viewport', () => {
    const track = { left: 100, width: 300 };

    expect(getTimelineIndexAtClientX(100, track, VIEWPORT)).toBe(10);
    expect(getTimelineIndexAtClientX(250, track, VIEWPORT)).toBe(25);
    expect(getTimelineIndexAtClientX(400, track, VIEWPORT)).toBe(40);
    expect(getTimelineIndexAtClientX(0, track, VIEWPORT)).toBe(10);
    expect(getTimelineIndexAtClientX(500, track, VIEWPORT)).toBe(40);
  });

  it('falls back to the viewport start without measurable track geometry', () => {
    expect(getTimelineIndexAtClientX(250, undefined, VIEWPORT)).toBe(10);
    expect(getTimelineIndexAtClientX(250, { left: 100, width: 0 }, VIEWPORT)).toBe(10);
    expect(getTimelineIndexAtClientX(250, { left: 100, width: 300 }, { from: 7, to: 7 })).toBe(7);
  });

  it('brushes in either direction from the gesture origin', () => {
    const gesture: TimelinePointerGesture = {
      type: 'brush',
      startIndex: 24,
    };

    expect(resolveTimelineGestureSelection(gesture, 14, VIEWPORT)).toEqual({ from: 14, to: 24 });
    expect(resolveTimelineGestureSelection(gesture, 36, VIEWPORT)).toEqual({ from: 24, to: 36 });
  });

  it('moves a range without changing its span or leaving the viewport', () => {
    const gesture: TimelinePointerGesture = {
      type: 'pan',
      startIndex: 20,
      originalSelection: { from: 15, to: 25 },
    };

    expect(resolveTimelineGestureSelection(gesture, 30, VIEWPORT)).toEqual({ from: 25, to: 35 });
    expect(resolveTimelineGestureSelection(gesture, 0, VIEWPORT)).toEqual({ from: 10, to: 20 });
    expect(resolveTimelineGestureSelection(gesture, 50, VIEWPORT)).toEqual({ from: 30, to: 40 });
  });

  it('resizes only the requested boundary within the selection and viewport', () => {
    const fromGesture: TimelinePointerGesture = {
      type: 'handle',
      boundary: 'from',
      originalSelection: { from: 15, to: 30 },
    };
    const toGesture: TimelinePointerGesture = {
      type: 'handle',
      boundary: 'to',
      originalSelection: { from: 15, to: 30 },
    };

    expect(resolveTimelineGestureSelection(fromGesture, 35, VIEWPORT)).toEqual({
      from: 30,
      to: 30,
    });
    expect(resolveTimelineGestureSelection(fromGesture, 0, VIEWPORT)).toEqual({
      from: 10,
      to: 30,
    });
    expect(resolveTimelineGestureSelection(toGesture, 5, VIEWPORT)).toEqual({
      from: 15,
      to: 15,
    });
    expect(resolveTimelineGestureSelection(toGesture, 50, VIEWPORT)).toEqual({
      from: 15,
      to: 40,
    });
  });

  it('preserves the active boundary in the interaction state', () => {
    expect(getTimelineInteraction({ type: 'brush', startIndex: 20 })).toEqual({
      type: 'selecting',
    });
    expect(
      getTimelineInteraction({
        type: 'pan',
        startIndex: 20,
        originalSelection: { from: 15, to: 30 },
      }),
    ).toEqual({ type: 'moving' });
    expect(
      getTimelineInteraction({
        type: 'handle',
        boundary: 'from',
        originalSelection: { from: 15, to: 30 },
      }),
    ).toEqual({ type: 'resizing', boundary: 'from' });
    expect(
      getTimelineInteraction({
        type: 'handle',
        boundary: 'to',
        originalSelection: { from: 15, to: 30 },
      }),
    ).toEqual({ type: 'resizing', boundary: 'to' });
  });

  it('moves a selection from the keyboard without changing its span or bounds', () => {
    const selection = { from: 10, to: 20 };

    expect(moveTimelineSelectionFromKey(selection, 'ArrowLeft', 40)).toEqual({ from: 9, to: 19 });
    expect(moveTimelineSelectionFromKey(selection, 'PageUp', 40)).toEqual({ from: 17, to: 27 });
    expect(moveTimelineSelectionFromKey(selection, 'Home', 40)).toEqual({ from: 0, to: 10 });
    expect(moveTimelineSelectionFromKey(selection, 'End', 40)).toEqual({ from: 30, to: 40 });
    expect(moveTimelineSelectionFromKey({ from: 0, to: 10 }, 'PageDown', 40)).toEqual({
      from: 0,
      to: 10,
    });
    expect(moveTimelineSelectionFromKey(selection, 'Enter', 40)).toBeUndefined();
  });

  it('resizes one keyboard boundary while preserving the other', () => {
    const selection = { from: 10, to: 20 };

    expect(resizeTimelineSelectionFromKey(selection, 'from', 'PageUp', 40)).toEqual({
      from: 17,
      to: 20,
    });
    expect(resizeTimelineSelectionFromKey(selection, 'to', 'PageDown', 40)).toEqual({
      from: 10,
      to: 13,
    });
    expect(resizeTimelineSelectionFromKey(selection, 'from', 'End', 40)).toEqual({
      from: 20,
      to: 20,
    });
    expect(resizeTimelineSelectionFromKey(selection, 'to', 'Home', 40)).toEqual({
      from: 10,
      to: 10,
    });
  });

  it.each([
    ['ArrowLeft', { from: 9, to: 19 }],
    ['ArrowDown', { from: 9, to: 19 }],
    ['ArrowRight', { from: 11, to: 21 }],
    ['ArrowUp', { from: 11, to: 21 }],
    ['PageDown', { from: 3, to: 13 }],
    ['PageUp', { from: 17, to: 27 }],
  ])('steps a selection by one day or one week on %s', (key, expected) => {
    expect(moveTimelineSelectionFromKey({ from: 10, to: 20 }, key, 40)).toEqual(expected);
  });

  it('stops a keyboard move at the last index', () => {
    expect(moveTimelineSelectionFromKey({ from: 30, to: 40 }, 'ArrowRight', 40)).toEqual({ from: 30, to: 40 });
    expect(moveTimelineSelectionFromKey({ from: 28, to: 38 }, 'PageUp', 40)).toEqual({ from: 30, to: 40 });
  });

  it.each([
    ['ArrowLeft', { from: 9, to: 20 }],
    ['ArrowDown', { from: 9, to: 20 }],
    ['ArrowRight', { from: 11, to: 20 }],
    ['ArrowUp', { from: 11, to: 20 }],
    ['PageDown', { from: 3, to: 20 }],
    ['PageUp', { from: 17, to: 20 }],
  ])('steps the from boundary on %s', (key, expected) => {
    expect(resizeTimelineSelectionFromKey({ from: 10, to: 20 }, 'from', key, 40)).toEqual(expected);
  });

  it('jumps a resized boundary to the far end', () => {
    const selection = { from: 10, to: 20 };

    expect(resizeTimelineSelectionFromKey(selection, 'from', 'Home', 40)).toEqual({ from: 0, to: 20 });
    expect(resizeTimelineSelectionFromKey(selection, 'to', 'End', 40)).toEqual({ from: 10, to: 40 });
  });

  it('collapses a resized boundary rather than crossing the other one', () => {
    const selection = { from: 10, to: 20 };

    expect(resizeTimelineSelectionFromKey(selection, 'from', 'End', 40)).toEqual({ from: 20, to: 20 });
    expect(resizeTimelineSelectionFromKey(selection, 'to', 'Home', 40)).toEqual({ from: 10, to: 10 });
    // Stepping past the other boundary pins to it instead of inverting.
    expect(resizeTimelineSelectionFromKey({ from: 19, to: 20 }, 'from', 'PageUp', 40)).toEqual({ from: 20, to: 20 });
    expect(resizeTimelineSelectionFromKey({ from: 19, to: 20 }, 'to', 'PageDown', 40)).toEqual({ from: 19, to: 19 });
  });

  it('stops a resized boundary at the timeline ends', () => {
    expect(resizeTimelineSelectionFromKey({ from: 2, to: 20 }, 'from', 'PageDown', 40)).toEqual({ from: 0, to: 20 });
    expect(resizeTimelineSelectionFromKey({ from: 10, to: 38 }, 'to', 'PageUp', 40)).toEqual({ from: 10, to: 40 });
  });

  it('ignores a key that means nothing to the timeline', () => {
    expect(resizeTimelineSelectionFromKey({ from: 10, to: 20 }, 'from', 'Enter', 40)).toBeUndefined();
    expect(resizeTimelineSelectionFromKey({ from: 10, to: 20 }, 'to', 'Escape', 40)).toBeUndefined();
  });
});
