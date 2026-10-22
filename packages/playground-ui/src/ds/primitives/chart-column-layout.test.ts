import { describe, expect, it } from 'vitest';
import { singleBarBox, stackedSegmentBox } from './chart-column-layout';

/** Every segment of one column, as Recharts would hand them over (true scale, bottom at 200). */
function column(values: number[], ppu: number, opts?: { gap?: number; minSize?: number }) {
  let base = 200;
  return values.map((v, i) => {
    const geo = { y: base - v * ppu, height: v * ppu };
    base -= v * ppu;
    return stackedSegmentBox(values, i, geo, opts);
  });
}

describe('stackedSegmentBox', () => {
  it('draws nothing for a zero value', () => {
    expect(column([100, 0, 5], 1)[1]).toBeUndefined();
  });

  it('keeps a tiny segment at the minimum and the column at its true height', () => {
    const boxes = column([3000, 1], 0.05, { gap: 2 });
    expect(boxes[1]?.height).toBe(3);
    // 3000 * 0.05 + 1 * 0.05 = 150.05px, from y 49.95 to 200.
    expect(boxes[1]?.y).toBeCloseTo(49.95);
    expect((boxes[0]?.y ?? 0) + (boxes[0]?.height ?? 0)).toBeCloseTo(200);
  });

  it('grows a column too short for its segments, so none is sub-pixel', () => {
    const boxes = column([1, 1], 0.05, { gap: 2 });
    for (const b of boxes) expect(b?.height).toBeGreaterThanOrEqual(3);
    expect((boxes[0]?.y ?? 0) + (boxes[0]?.height ?? 0)).toBeCloseTo(200);
  });

  it('never squeezes the large segment under the minimum to make room', () => {
    const boxes = column([1, 1, 1, 7], 1, { gap: 2 });
    for (const b of boxes) expect(b?.height).toBeGreaterThanOrEqual(3);
  });
});

describe('singleBarBox', () => {
  it('grows a tiny bar up from its base', () => {
    expect(singleBarBox(1, { y: 199.9, height: 0.1 })).toEqual({ y: 197, height: 3 });
  });

  it('drops zeros', () => {
    expect(singleBarBox(0, { y: 200, height: 0 })).toBeUndefined();
  });
});

describe('column layout with bad values', () => {
  const geo = { y: 100, height: 100 };

  it('draws nothing for NaN, negative or missing values', () => {
    expect(stackedSegmentBox([Number.NaN, 5], 0, geo)).toBeUndefined();
    expect(stackedSegmentBox([-3, 5], 0, geo)).toBeUndefined();
    expect(stackedSegmentBox([5], 3, geo)).toBeUndefined();
    expect(singleBarBox(Number.NaN, geo)).toBeUndefined();
    expect(singleBarBox(-1, geo)).toBeUndefined();
  });

  it('ignores NaN and negative neighbours when stacking', () => {
    const box = stackedSegmentBox([Number.NaN, -4, 10], 2, { y: 0, height: 100 });
    expect(box).toEqual({ y: 0, height: 100 });
  });

  it('keeps every segment finite when Recharts reports a zero-height box', () => {
    const box = stackedSegmentBox([1, 1], 1, { y: 200, height: 0 }, { gap: 2 });
    expect(box && Number.isFinite(box.y) && Number.isFinite(box.height)).toBe(true);
    expect(box?.height).toBe(3);
  });
});
