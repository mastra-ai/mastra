import { describe, expect, it } from 'vitest';
import { resolveDateRangeBoundaryLayout } from './date-range-boundary-layout';

function expectCollisionFreeLayout(width: number, positions: { from: number; to: number }) {
  const layout = resolveDateRangeBoundaryLayout(width, positions);

  expect(layout.from.left).toBeGreaterThanOrEqual(0);
  expect(layout.to.left).toBeGreaterThanOrEqual(0);
  expect(layout.from.left + layout.from.width).toBeLessThanOrEqual(width);
  expect(layout.to.left + layout.to.width).toBeLessThanOrEqual(width);
  expect(layout.from.left + layout.from.width + layout.gap).toBeLessThanOrEqual(layout.to.left);
}

describe('resolveDateRangeBoundaryLayout', () => {
  it('keeps a one-day range collision-free at the right edge of a narrow timeline', () => {
    const layout = resolveDateRangeBoundaryLayout(260, { from: 80, to: 100 });

    expect(layout).toEqual({
      from: { left: 0, width: 126 },
      to: { left: 134, width: 126 },
      gap: 8,
    });
  });

  it('keeps close labels collision-free at either edge and at the center', () => {
    expectCollisionFreeLayout(260, { from: 0, to: 20 });
    expectCollisionFreeLayout(390, { from: 92, to: 100 });
    expectCollisionFreeLayout(960, { from: 50, to: 50 });
  });

  it('preserves the outward handle association when there is enough room', () => {
    const layout = resolveDateRangeBoundaryLayout(960, { from: 35, to: 65 });

    expect(layout).toEqual({
      from: { left: 172, width: 160 },
      to: { left: 628, width: 160 },
      gap: 8,
    });
  });

  it('pins the overlapping pair to the right edge instead of overshooting it', () => {
    const layout = resolveDateRangeBoundaryLayout(960, { from: 95, to: 100 });

    expect(layout).toEqual({
      from: { left: 632, width: 160 },
      to: { left: 800, width: 160 },
      gap: 8,
    });
  });

  it('pins the overlapping pair to the left edge when both handles sit at the start', () => {
    const layout = resolveDateRangeBoundaryLayout(400, { from: 0, to: 0 });

    expect(layout).toEqual({
      from: { left: 0, width: 160 },
      to: { left: 168, width: 160 },
      gap: 8,
    });
  });

  it('counts the gap as taken space when deciding the labels overlap', () => {
    // `to` sits exactly one gap away from the `from` label's right edge: the
    // labels only fit if the gap is charged against the available room.
    const layout = resolveDateRangeBoundaryLayout(1600, { from: 0, to: 9.75 });

    expect(layout).toEqual({
      from: { left: 0, width: 160 },
      to: { left: 168, width: 160 },
      gap: 8,
    });
  });

  it('adapts both label widths when the timeline is narrower than the preferred pair', () => {
    const layout = resolveDateRangeBoundaryLayout(240, { from: 95, to: 100 });

    expect(layout.from.width).toBe(116);
    expect(layout.to.width).toBe(116);
    expectCollisionFreeLayout(240, { from: 95, to: 100 });
  });
});
