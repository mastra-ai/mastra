import { describe, expect, it } from 'vitest';
import { parseISO } from 'date-fns';
import {
  clampDateRangeToBounds,
  createTimelineState,
  formatDateRangeDuration,
  formatDateRangeValueText,
  revealTimelineSelection,
  toDateRange,
  zoomTimelineViewport,
} from './date-range-timeline';

describe('date range timeline', () => {
  it('keeps the visible domain anchored to creation and today', () => {
    const state = createTimelineState(
      { from: '2026-05-20', to: '2026-06-05' },
      parseISO('2026-05-07'),
      parseISO('2026-07-10'),
    );

    expect(state.origin).toEqual(parseISO('2026-05-07'));
    expect(state.viewport).toEqual({ from: 0, to: 64 });
    expect(toDateRange(state)).toEqual({ from: '2026-05-20', to: '2026-06-05' });
  });

  it('clamps an existing selection to a newer database lifetime', () => {
    expect(
      clampDateRangeToBounds(
        { from: '2026-06-10', to: '2026-07-10' },
        { min: '2026-07-01', max: '2026-07-10' },
      ),
    ).toEqual({ from: '2026-07-01', to: '2026-07-10' });
  });

  it('supports a one-day range for a database created today', () => {
    const range = { from: '2026-07-10', to: '2026-07-10' };

    expect(formatDateRangeDuration(range)).toBe('1 day');
    expect(formatDateRangeValueText(range)).toBe('July 10, 2026 through July 10, 2026');
  });

  it('zooms the viewport while preserving the selected range', () => {
    const state = createTimelineState(
      { from: '2026-05-20', to: '2026-06-05' },
      parseISO('2026-05-07'),
      parseISO('2026-07-10'),
    );

    const zoomed = zoomTimelineViewport(state, 64, 0.5, 0.5);

    expect(zoomed.viewport).toEqual({ from: 13, to: 45 });
    expect(toDateRange(zoomed)).toEqual({ from: '2026-05-20', to: '2026-06-05' });
    expect(zoomTimelineViewport(state, 64, 0.01, 0.5).viewport).toEqual({ from: 13, to: 29 });
    expect(zoomTimelineViewport(zoomed, 64, 10, 0.5).viewport).toEqual({ from: 0, to: 64 });
  });

  it('normalizes an inverted initial selection', () => {
    const state = createTimelineState(
      { from: '2026-06-05', to: '2026-05-20' },
      parseISO('2026-05-07'),
      parseISO('2026-07-10'),
    );

    expect(toDateRange(state)).toEqual({ from: '2026-05-20', to: '2026-06-05' });
  });

  it('reveals a selection outside the current viewport without exceeding its bounds', () => {
    expect(revealTimelineSelection({ from: 20, to: 40 }, { from: 50, to: 55 }, 64)).toEqual({
      from: 35,
      to: 55,
    });
  });
});
