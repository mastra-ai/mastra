import { parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { createTimelineState } from './date-range-timeline';
import {
  createDateRangeAxisModel,
  createDateRangeBoundaryModel,
  createDateRangeTrackModel,
} from './date-range-timeline-view-model';

describe('date range timeline view model', () => {
  it('derives the selection, handle, and axis presentation from timeline state', () => {
    const state = createTimelineState(
      { from: '2026-06-10', to: '2026-06-20' },
      parseISO('2026-06-01'),
      parseISO('2026-06-30'),
    );

    const boundaryModel = createDateRangeBoundaryModel(state);
    const trackModel = createDateRangeTrackModel(state, 29);
    const axisModel = createDateRangeAxisModel(state);

    expect(boundaryModel).toEqual({
      positions: { from: (9 / 29) * 100, to: (19 / 29) * 100 },
      range: { from: '2026-06-10', to: '2026-06-20' },
    });
    expect(trackModel.selection).toEqual({
      left: (9 / 29) * 100,
      width: (10 / 29) * 100,
      duration: '11 days',
      value: 9,
      valueText: 'June 10, 2026 through June 20, 2026',
      max: 19,
    });
    expect(trackModel.handles).toEqual({
      from: {
        position: (9 / 29) * 100,
        value: 9,
        valueText: '2026-06-10',
        min: 0,
        max: 19,
      },
      to: {
        position: (19 / 29) * 100,
        value: 19,
        valueText: '2026-06-20',
        min: 9,
        max: 29,
      },
    });
    expect(axisModel.ticks).toHaveLength(5);
  });
});
