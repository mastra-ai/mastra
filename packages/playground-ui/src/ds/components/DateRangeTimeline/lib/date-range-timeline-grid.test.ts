import { describe, expect, it } from 'vitest';
import { createDateRangeGridMarkers } from './date-range-timeline-grid';

const indicesOf = (markers: ReturnType<typeof createDateRangeGridMarkers>, emphasis?: string) =>
  markers.filter(marker => emphasis === undefined || marker.emphasis === emphasis).map(marker => marker.index);

describe('date range timeline grid', () => {
  it('aligns grid markers with the selected dates and labeled date scale', () => {
    const markers = createDateRangeGridMarkers({ from: 0, to: 21 }, { from: 1, to: 19 });

    expect(markers).toHaveLength(22);
    expect(markers).toContainEqual({
      index: 1,
      position: (1 / 21) * 100,
      emphasis: 'minor',
    });
    expect(markers).toContainEqual({
      index: 19,
      position: (19 / 21) * 100,
      emphasis: 'medium',
    });
    expect(indicesOf(markers, 'major')).toEqual([0, 5, 11, 16, 21]);
  });

  it('keeps selected dates on the grid when minor markers are sampled', () => {
    const markers = createDateRangeGridMarkers({ from: 0, to: 100 }, { from: 17, to: 83 });

    expect(markers).toContainEqual({ index: 17, position: 17, emphasis: 'minor' });
    expect(markers).toContainEqual({ index: 83, position: 83, emphasis: 'minor' });
    // A 100-day viewport samples every 5th day rather than drawing all 101.
    expect(indicesOf(markers)).toEqual([
      0, 5, 10, 13, 15, 17, 20, 25, 30, 35, 38, 40, 45, 50, 55, 60, 63, 65, 70, 75, 80, 83, 85, 88, 90, 95, 100,
    ]);
    expect(indicesOf(markers, 'major')).toEqual([0, 25, 50, 75, 100]);
    expect(indicesOf(markers, 'medium')).toEqual([13, 38, 63, 88]);
  });

  it('measures the viewport from its own start, not from day zero', () => {
    const markers = createDateRangeGridMarkers({ from: 10, to: 60 }, { from: 20, to: 50 });

    // Sorted ascending, and the labeled scale plus its midpoints land off the
    // sampling step, so they are added on their own.
    expect(indicesOf(markers)).toEqual([
      10, 13, 16, 17, 19, 20, 22, 23, 25, 28, 29, 31, 34, 35, 37, 40, 42, 43, 46, 48, 49, 50, 52, 54, 55, 58, 60,
    ]);
    expect(indicesOf(markers, 'major')).toEqual([10, 23, 35, 48, 60]);
    expect(indicesOf(markers, 'medium')).toEqual([17, 29, 42, 54]);
    expect(markers[0]).toEqual({ index: 10, position: 0, emphasis: 'major' });
  });

  it('drops selected dates that fall outside the viewport', () => {
    const markers = createDateRangeGridMarkers({ from: 5, to: 20 }, { from: 2, to: 25 });

    expect(indicesOf(markers)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('centers a single marker when the viewport spans one day', () => {
    expect(createDateRangeGridMarkers({ from: 7, to: 7 }, { from: 7, to: 7 })).toEqual([
      { index: 7, position: 50, emphasis: 'major' },
    ]);
  });
});
