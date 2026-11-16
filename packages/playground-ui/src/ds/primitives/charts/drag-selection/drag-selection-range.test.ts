import { describe, expect, it } from 'vitest';
import { activeIndex, orderedRange, selectionBandBox } from './drag-selection-range';

const area = { x: 40, y: 10, width: 600, height: 100 };

describe('orderedRange', () => {
  it('keeps a left-to-right range as is', () => {
    expect(orderedRange(1, 3)).toEqual({ start: 1, end: 3 });
  });

  it('orders a right-to-left range', () => {
    expect(orderedRange(3, 0)).toEqual({ start: 0, end: 3 });
  });
});

describe('activeIndex', () => {
  it('reads the hovered index from a Recharts mouse payload', () => {
    expect(activeIndex({ activeTooltipIndex: 2 })).toBe(2);
    expect(activeIndex({ activeTooltipIndex: '2' })).toBe(2);
  });

  it('is undefined when the pointer is over no point', () => {
    expect(activeIndex(undefined)).toBeUndefined();
    expect(activeIndex({ activeTooltipIndex: null })).toBeUndefined();
    expect(activeIndex({})).toBeUndefined();
  });
});

describe('selectionBandBox', () => {
  describe('on a band axis (bars)', () => {
    it('covers the selected columns, each owning an equal slot', () => {
      expect(selectionBandBox({ start: 1, end: 2 }, 4, area)).toEqual({ x: 190, y: 10, width: 300, height: 100 });
    });

    it('covers the whole plot when every column is selected', () => {
      expect(selectionBandBox({ start: 0, end: 3 }, 4, area)).toEqual(area);
    });
  });

  describe('on a point axis (lines)', () => {
    it('reaches halfway to the neighbouring points', () => {
      // Four points 200px apart, at 40, 240, 440, 640.
      expect(selectionBandBox({ start: 1, end: 2 }, 4, area, 'point')).toEqual({
        x: 140,
        y: 10,
        width: 400,
        height: 100,
      });
    });

    it('stops at the plot edges', () => {
      expect(selectionBandBox({ start: 0, end: 3 }, 4, area, 'point')).toEqual(area);
    });

    it('covers the plot when there is a single point', () => {
      expect(selectionBandBox({ start: 0, end: 0 }, 1, area, 'point')).toEqual(area);
    });
  });

  it('draws nothing without data', () => {
    expect(selectionBandBox({ start: 0, end: 1 }, 0, area)).toBeUndefined();
  });
});
