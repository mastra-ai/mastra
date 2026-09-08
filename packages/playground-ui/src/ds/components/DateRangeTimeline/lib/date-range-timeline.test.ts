import { parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';
import {
  buildTimelineTickOffsets,
  buildTimelineTicks,
  clamp,
  clampDateRangeToBounds,
  createTimelineState,
  formatDateRangeDuration,
  formatDateRangeValueText,
  getDateRangeBounds,
  getTimelinePosition,
  parseDate,
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
      clampDateRangeToBounds({ from: '2026-06-10', to: '2026-07-10' }, { min: '2026-07-01', max: '2026-07-10' }),
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

describe('clamp', () => {
  it('holds a value inside its bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('lets the upper bound win when the bounds are inverted', () => {
    expect(clamp(5, 10, 0)).toBe(0);
  });
});

describe('parseDate', () => {
  it('accepts a calendar date in the API format', () => {
    expect(parseDate('2026-07-10')).toEqual(parseISO('2026-07-10'));
  });

  it.each([
    ['an unpadded month', '2026-7-10'],
    ['a day that does not exist', '2026-02-30'],
    ['a timestamp rather than a date', '2026-07-10T00:00:00Z'],
    ['free text', 'nope'],
    ['an empty string', ''],
  ])('rejects %s', (_, value) => {
    expect(parseDate(value)).toBeUndefined();
  });
});

describe('getTimelinePosition', () => {
  it('maps an index onto a percentage of the viewport', () => {
    expect(getTimelinePosition(0, { from: 0, to: 10 })).toBe(0);
    expect(getTimelinePosition(5, { from: 0, to: 10 })).toBe(50);
    expect(getTimelinePosition(10, { from: 0, to: 10 })).toBe(100);
  });

  it('measures from the viewport start, not from index zero', () => {
    expect(getTimelinePosition(15, { from: 10, to: 20 })).toBe(50);
    expect(getTimelinePosition(10, { from: 10, to: 20 })).toBe(0);
  });

  it('centers the only index of a one-day viewport', () => {
    expect(getTimelinePosition(7, { from: 7, to: 7 })).toBe(50);
  });
});

describe('buildTimelineTickOffsets', () => {
  it('spreads at most five ticks evenly across the span', () => {
    expect(buildTimelineTickOffsets(64)).toEqual([0, 16, 32, 48, 64]);
    expect(buildTimelineTickOffsets(21)).toEqual([0, 5, 11, 16, 21]);
  });

  it('never emits more ticks than the span has days', () => {
    expect(buildTimelineTickOffsets(1)).toEqual([0, 1]);
    expect(buildTimelineTickOffsets(3)).toEqual([0, 1, 2, 3]);
  });

  it('collapses to a single tick for an empty or negative span', () => {
    expect(buildTimelineTickOffsets(0)).toEqual([0]);
    expect(buildTimelineTickOffsets(-5)).toEqual([0]);
  });

  it('floors a fractional span', () => {
    expect(buildTimelineTickOffsets(3.7)).toEqual([0, 1, 2, 3]);
  });
});

describe('buildTimelineTicks', () => {
  it('labels ticks with the day inside a single year', () => {
    expect(buildTimelineTicks(parseISO('2026-05-07'), parseISO('2026-07-10'))).toEqual([
      { date: '2026-05-07', label: 'May 7', position: 0 },
      { date: '2026-05-23', label: 'May 23', position: 25 },
      { date: '2026-06-08', label: 'Jun 8', position: 50 },
      { date: '2026-06-24', label: 'Jun 24', position: 75 },
      { date: '2026-07-10', label: 'Jul 10', position: 100 },
    ]);
  });

  it('drops the day for a domain that crosses a year boundary', () => {
    expect(buildTimelineTicks(parseISO('2025-11-01'), parseISO('2026-02-01')).map(tick => tick.label)).toEqual([
      'Nov 2025',
      'Nov 2025',
      'Dec 2025',
      'Jan 2026',
      'Feb 2026',
    ]);
  });

  it('drops the day for a domain longer than a year', () => {
    expect(buildTimelineTicks(parseISO('2024-01-01'), parseISO('2026-01-01')).map(tick => tick.label)).toEqual([
      'Jan 2024',
      'Jul 2024',
      'Jan 2025',
      'Jul 2025',
      'Jan 2026',
    ]);
  });

  it('centers the single tick of an empty domain', () => {
    expect(buildTimelineTicks(parseISO('2026-05-07'), parseISO('2026-05-07'))).toEqual([
      { date: '2026-05-07', label: 'May 7', position: 50 },
    ]);
  });
});

describe('getDateRangeBounds', () => {
  it('spans creation to today', () => {
    expect(getDateRangeBounds('2026-05-07', '2026-07-10')).toEqual({ min: '2026-05-07', max: '2026-07-10' });
  });

  it('never lets the lower bound run past today', () => {
    expect(getDateRangeBounds('2026-08-01', '2026-07-10')).toEqual({ min: '2026-07-10', max: '2026-07-10' });
  });

  it('falls back to today when the creation date is unusable', () => {
    expect(getDateRangeBounds('nope', '2026-07-10')).toEqual({ min: '2026-07-10', max: '2026-07-10' });
  });
});

describe('formatDateRangeDuration', () => {
  it('counts both endpoints', () => {
    expect(formatDateRangeDuration({ from: '2026-07-09', to: '2026-07-10' })).toBe('2 days');
  });

  it('reports at least one day for an inverted range', () => {
    expect(formatDateRangeDuration({ from: '2026-06-05', to: '2026-05-20' })).toBe('1 day');
  });

  it('is empty when either end is unusable', () => {
    expect(formatDateRangeDuration({ from: 'nope', to: '2026-07-10' })).toBe('');
    expect(formatDateRangeDuration({ from: '2026-07-10', to: 'nope' })).toBe('');
  });
});

describe('formatDateRangeValueText', () => {
  it('spells out both endpoints', () => {
    expect(formatDateRangeValueText({ from: '2026-05-20', to: '2026-06-05' })).toBe(
      'May 20, 2026 through June 5, 2026',
    );
  });

  it('echoes the raw values when either end is unusable', () => {
    expect(formatDateRangeValueText({ from: 'nope', to: '2026-07-10' })).toBe('nope through 2026-07-10');
  });
});

describe('clampDateRangeToBounds', () => {
  it('returns the value untouched when the bounds are unusable', () => {
    const value = { from: '2026-06-10', to: '2026-07-10' };
    expect(clampDateRangeToBounds(value, { min: 'nope', max: '2026-07-10' })).toBe(value);
    expect(clampDateRangeToBounds(value, { min: '2026-07-01', max: 'nope' })).toBe(value);
  });

  it('falls back to the bounds when either end is unusable', () => {
    expect(clampDateRangeToBounds({ from: 'nope', to: 'nope' }, { min: '2026-07-01', max: '2026-07-10' })).toEqual({
      from: '2026-07-01',
      to: '2026-07-10',
    });
  });

  it('never lets the upper end fall below the clamped lower end', () => {
    expect(
      clampDateRangeToBounds({ from: '2026-07-05', to: '2026-06-01' }, { min: '2026-07-01', max: '2026-07-10' }),
    ).toEqual({ from: '2026-07-05', to: '2026-07-05' });
  });
});

describe('zoomTimelineViewport', () => {
  const state = createTimelineState(
    { from: '2026-05-20', to: '2026-06-05' },
    parseISO('2026-05-07'),
    parseISO('2026-07-10'),
  );

  it.each([
    ['a factor of exactly one', 1],
    ['a zero factor', 0],
    ['a negative factor', -2],
    ['a non-finite factor', Number.NaN],
    ['an infinite factor', Number.POSITIVE_INFINITY],
  ])('is a no-op for %s', (_, factor) => {
    expect(zoomTimelineViewport(state, 64, factor, 0.5)).toBe(state);
  });

  it('keeps the anchor point fixed while the span shrinks', () => {
    expect(zoomTimelineViewport(state, 64, 0.5, 0).viewport).toEqual({ from: 0, to: 32 });
    expect(zoomTimelineViewport(state, 64, 0.5, 1).viewport).toEqual({ from: 13, to: 45 });
  });

  it('centers on a non-finite anchor', () => {
    expect(zoomTimelineViewport(state, 64, 0.5, Number.NaN).viewport).toEqual({ from: 13, to: 45 });
  });

  it('never zooms past the selection it must keep visible', () => {
    expect(zoomTimelineViewport(state, 64, 0.01, 0.5).viewport).toEqual({ from: 13, to: 29 });
  });

  it('measures the span of a viewport that does not start at zero', () => {
    const offset = { origin: parseISO('2026-05-07'), viewport: { from: 13, to: 45 }, selection: { from: 20, to: 25 } };

    expect(zoomTimelineViewport(offset, 64, 0.5, 0.5).viewport).toEqual({ from: 20, to: 36 });
  });

  it('keeps the anchor point fixed when nothing forces a clamp', () => {
    const centered = { origin: parseISO('2026-05-07'), viewport: { from: 0, to: 64 }, selection: { from: 30, to: 32 } };

    expect(zoomTimelineViewport(centered, 64, 0.5, 0.5).viewport).toEqual({ from: 16, to: 48 });
  });

  it('still steps by a day when the factor rounds to no change at all', () => {
    const narrow = { origin: parseISO('2026-05-07'), viewport: { from: 0, to: 2 }, selection: { from: 0, to: 0 } };

    expect(zoomTimelineViewport(narrow, 10, 0.99, 0.5).viewport).toEqual({ from: 0, to: 1 });
    expect(zoomTimelineViewport(narrow, 10, 1.01, 0.5).viewport).toEqual({ from: 0, to: 3 });
  });

  it('is a no-op once the viewport cannot shrink any further', () => {
    const atMinimum = {
      origin: parseISO('2026-05-07'),
      viewport: { from: 0, to: 1 },
      selection: { from: 0, to: 1 },
    };

    expect(zoomTimelineViewport(atMinimum, 64, 0.5, 0.5)).toBe(atMinimum);
  });
});

describe('revealTimelineSelection', () => {
  it('returns the viewport untouched when the selection already fits', () => {
    const viewport = { from: 0, to: 64 };
    expect(revealTimelineSelection(viewport, { from: 10, to: 20 }, 64)).toBe(viewport);
  });

  it('pulls back to a selection that sits before the viewport', () => {
    expect(revealTimelineSelection({ from: 30, to: 50 }, { from: 5, to: 10 }, 64)).toEqual({ from: 5, to: 25 });
  });

  it('normalizes a viewport that runs past the maximum index', () => {
    expect(revealTimelineSelection({ from: 60, to: 80 }, { from: 10, to: 20 }, 64)).toEqual({ from: 10, to: 30 });
  });

  it('normalizes an inverted selection before revealing it', () => {
    expect(revealTimelineSelection({ from: 20, to: 40 }, { from: 55, to: 50 }, 64)).toEqual({ from: 35, to: 55 });
  });

  it('returns the normalized window, not the out-of-bounds one it was given', () => {
    // The selection is inside the viewport as written, but the viewport itself
    // runs past the last index and has to be pulled back first.
    expect(revealTimelineSelection({ from: 60, to: 80 }, { from: 62, to: 63 }, 64)).toEqual({ from: 44, to: 64 });
  });

  it('leaves the viewport alone when the selection starts exactly at its edge', () => {
    const viewport = { from: 10, to: 40 };

    expect(revealTimelineSelection(viewport, { from: 10, to: 20 }, 64)).toBe(viewport);
    expect(revealTimelineSelection(viewport, { from: 20, to: 40 }, 64)).toBe(viewport);
  });
});

describe('createTimelineState', () => {
  it('collapses to a single index when creation and today are the same day', () => {
    expect(
      createTimelineState({ from: '2026-07-10', to: '2026-07-10' }, parseISO('2026-07-10'), parseISO('2026-07-10')),
    ).toEqual({
      origin: parseISO('2026-07-10'),
      viewport: { from: 0, to: 0 },
      selection: { from: 0, to: 0 },
    });
  });

  it('clamps a selection that reaches outside the domain', () => {
    const state = createTimelineState(
      { from: '2026-01-01', to: '2026-12-31' },
      parseISO('2026-05-07'),
      parseISO('2026-07-10'),
    );

    expect(state.selection).toEqual({ from: 0, to: 64 });
  });

  it('falls back to the domain ends when either date is unusable', () => {
    const state = createTimelineState({ from: 'nope', to: 'nope' }, parseISO('2026-05-07'), parseISO('2026-07-10'));

    expect(toDateRange(state)).toEqual({ from: '2026-05-07', to: '2026-07-10' });
  });
});
