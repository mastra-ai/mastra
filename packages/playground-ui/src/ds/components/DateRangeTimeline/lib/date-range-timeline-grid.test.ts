import { describe, expect, it } from 'vitest';
import { createDateRangeGridMarkers } from './date-range-timeline-grid';

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
    expect(
      markers.filter((marker) => marker.emphasis === 'major').map((marker) => marker.index),
    ).toEqual([0, 5, 11, 16, 21]);
  });

  it('keeps selected dates on the grid when minor markers are sampled', () => {
    const markers = createDateRangeGridMarkers({ from: 0, to: 100 }, { from: 17, to: 83 });

    expect(markers).toContainEqual({ index: 17, position: 17, emphasis: 'minor' });
    expect(markers).toContainEqual({ index: 83, position: 83, emphasis: 'minor' });
    expect(
      markers.filter((marker) => marker.emphasis === 'major').map((marker) => marker.index),
    ).toEqual([0, 25, 50, 75, 100]);
  });
});
