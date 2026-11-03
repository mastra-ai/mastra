import { describe, expect, it } from 'vitest';
import { fitDuration, fitViewport, RING_MIN_ZOOM } from './fitViewport';
import { READABLE_MIN_ZOOM } from './graphShape';
import { KNOWLEDGE_GRAPH_TRANSITION_MS } from './useLeavingNodes';

const box = (x: number, y: number, size = 100) => ({ position: { x, y }, width: size, height: size });
const anchor = box(-50, -50);
const WIDTH = 1000;
const HEIGHT = 600;

describe('fitViewport', () => {
  const ring = { x: -1200, y: -1200, width: 2400, height: 2400 };

  it('goes below the readable floor only when asked to frame a ring, so the whole ring is in view', () => {
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, focus: false, ring: true, anchor });
    expect(view.zoom).toBeLessThan(READABLE_MIN_ZOOM);
    expect(view.zoom).toBeGreaterThanOrEqual(RING_MIN_ZOOM);
    expect(ring.x * view.zoom + view.x).toBeGreaterThanOrEqual(0);
    expect((ring.x + ring.width) * view.zoom + view.x).toBeLessThanOrEqual(WIDTH);
    expect((ring.y + ring.height) * view.zoom + view.y).toBeLessThanOrEqual(HEIGHT);
  });

  it('keeps the readable floor for a focus without a ring, and centres on the focus when it bites', () => {
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, focus: true, anchor });
    expect(view.zoom).toBe(READABLE_MIN_ZOOM);
    expect(view.x).toBeCloseTo(WIDTH / 2, 5);
    expect(view.y).toBeCloseTo(HEIGHT / 2, 5);
  });
});

describe('fitDuration', () => {
  it('animates over the layout transition, and not at all under reduced motion', () => {
    expect(fitDuration(true)).toBe(KNOWLEDGE_GRAPH_TRANSITION_MS);
    expect(fitDuration(false)).toBe(0);
  });
});
