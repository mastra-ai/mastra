import { describe, expect, it } from 'vitest';
import { fitViewport } from './fitViewport';
import { READABLE_MIN_ZOOM } from './graphShape';

const box = (x: number, y: number, size = 100) => ({ position: { x, y }, width: size, height: size });
const anchor = box(-50, -50);
const WIDTH = 1000;
const HEIGHT = 600;

describe('fitViewport', () => {
  const ring = { x: -1200, y: -1200, width: 2400, height: 2400 };
  const near = { x: -300, y: -200, width: 600, height: 400 };

  it('zooms below the readable floor so a ring that does not fit at 0.7 is fully in view', () => {
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, focus: true, ring: true, anchor });
    expect(view.zoom).toBeLessThan(READABLE_MIN_ZOOM);
    // Every edge of the bounds lands inside the pane.
    expect(ring.x * view.zoom + view.x).toBeGreaterThanOrEqual(0);
    expect((ring.x + ring.width) * view.zoom + view.x).toBeLessThanOrEqual(WIDTH);
    expect(ring.y * view.zoom + view.y).toBeGreaterThanOrEqual(0);
    expect((ring.y + ring.height) * view.zoom + view.y).toBeLessThanOrEqual(HEIGHT);
  });

  it('keeps the readable floor for a focus without a ring, and centres on the focus when it bites', () => {
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, focus: true, ring: false, anchor });
    expect(view.zoom).toBe(READABLE_MIN_ZOOM);
    expect(view.x).toBeCloseTo(WIDTH / 2, 5);
    expect(view.y).toBeCloseTo(HEIGHT / 2, 5);
  });

  it('is unchanged when the bounds fit comfortably', () => {
    const withRing = fitViewport({ bounds: near, width: WIDTH, height: HEIGHT, focus: true, ring: true, anchor });
    const without = fitViewport({ bounds: near, width: WIDTH, height: HEIGHT, focus: true, ring: false, anchor });
    expect(withRing.zoom).toBeGreaterThanOrEqual(READABLE_MIN_ZOOM);
    expect(withRing.zoom).toBeCloseTo(without.zoom, 2);
  });
});
