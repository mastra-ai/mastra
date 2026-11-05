import { describe, expect, it } from 'vitest';
import {
  fitAllViewport,
  fitDuration,
  fitViewport,
  INITIAL_FIT_MAX_ZOOM,
  INITIAL_FIT_PADDING,
  NUDGE_PADDING,
  nudgeAxis,
  RING_MIN_ZOOM,
} from './fitViewport';
import { READABLE_MIN_ZOOM } from './graphShape';
import { KNOWLEDGE_GRAPH_TRANSITION_MS } from './useLeavingNodes';

const box = (x: number, y: number, size = 100) => ({ position: { x, y }, width: size, height: size });
const anchor = box(-50, -50);
const WIDTH = 1000;
const HEIGHT = 600;

describe('fitViewport', () => {
  const ring = { x: -1200, y: -1200, width: 2400, height: 2400 };

  it('goes below the readable floor only when asked to frame a ring, so the whole ring is in view', () => {
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, ring: true, anchor });
    expect(view.zoom).toBeLessThan(READABLE_MIN_ZOOM);
    expect(view.zoom).toBeGreaterThanOrEqual(RING_MIN_ZOOM);
    expect(ring.x * view.zoom + view.x).toBeGreaterThanOrEqual(0);
    expect((ring.x + ring.width) * view.zoom + view.x).toBeLessThanOrEqual(WIDTH);
    expect((ring.y + ring.height) * view.zoom + view.y).toBeLessThanOrEqual(HEIGHT);
  });

  it('frames the ring in the part of the pane the drawers leave uncovered', () => {
    const insets = { left: 200, right: 300 };
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, ring: true, anchor, insets });
    expect(ring.x * view.zoom + view.x).toBeGreaterThanOrEqual(insets.left);
    expect((ring.x + ring.width) * view.zoom + view.x).toBeLessThanOrEqual(WIDTH - insets.right);
  });

  it('centres a floored focus between the drawers', () => {
    const insets = { left: 300, right: 100 };
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, anchor, insets });
    expect(view.x).toBeCloseTo(insets.left + (WIDTH - insets.left - insets.right) / 2, 5);
  });

  it('centres in the whole pane when the drawers are wider than it', () => {
    const narrow = 600;
    const insets = { left: 296, right: 392 };
    expect(fitViewport({ bounds: ring, width: narrow, height: HEIGHT, anchor, insets })).toEqual(
      fitViewport({ bounds: ring, width: narrow, height: HEIGHT, anchor }),
    );
  });

  it('keeps the readable floor for a focus without a ring, and centres on the focus when it bites', () => {
    const view = fitViewport({ bounds: ring, width: WIDTH, height: HEIGHT, anchor });
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

describe('nudgeAxis', () => {
  it('does not move a page that is comfortably inside the pane', () => {
    expect(nudgeAxis(300, 100, 800)).toBe(0);
    expect(nudgeAxis(NUDGE_PADDING, 100, 800)).toBe(0);
  });

  it('moves a page past the start edge back in by just the missing distance', () => {
    expect(nudgeAxis(-200, 100, 800)).toBe(200 + NUDGE_PADDING);
    expect(nudgeAxis(10, 100, 800)).toBe(NUDGE_PADDING - 10);
  });

  it('moves a page past the end edge back in by just the missing distance', () => {
    expect(nudgeAxis(900, 100, 800)).toBe(-(900 + 100 - (800 - NUDGE_PADDING)));
  });

  it('centres a page too big to fit with its padding', () => {
    expect(nudgeAxis(-100, 760, 800)).toBe(400 - (-100 + 380));
  });
});

describe('fitAllViewport', () => {
  const rect = (x: number, y: number, size = 100) => ({ x, y, width: size, height: size });
  const topLeft = rect(-1000, -500);
  const bottomRight = rect(900, 400);
  const nodes = [topLeft, rect(900, -500), rect(-1000, 400), bottomRight, rect(-50, -50)];
  const bounds = { x: -1000, y: -500, width: 2000, height: 1000 };
  const screen = (view: { x: number; y: number; zoom: number }, n: ReturnType<typeof rect>) => ({
    left: n.x * view.zoom + view.x,
    top: n.y * view.zoom + view.y,
    right: (n.x + n.width) * view.zoom + view.x,
    bottom: (n.y + n.height) * view.zoom + view.y,
  });

  it('frames every node inside the pane with a margin', () => {
    const view = fitAllViewport({ bounds, nodes, width: WIDTH, height: HEIGHT });
    for (const n of nodes) {
      const at = screen(view, n);
      expect(at.left).toBeGreaterThanOrEqual(0);
      expect(at.right).toBeLessThanOrEqual(WIDTH);
      expect(at.top).toBeGreaterThanOrEqual(0);
      expect(at.bottom).toBeLessThanOrEqual(HEIGHT);
    }
    const first = screen(view, topLeft);
    const last = screen(view, bottomRight);
    const marginX = Math.min(first.left, WIDTH - last.right);
    const marginY = Math.min(first.top, HEIGHT - last.bottom);
    expect(Math.min(marginX, marginY)).toBeGreaterThan(INITIAL_FIT_PADDING * Math.min(WIDTH, HEIGHT) * 0.5);
  });

  it('goes below the readable floor when the graph is too big for it', () => {
    const wide = { x: -3000, y: -3000, width: 6000, height: 6000 };
    expect(fitAllViewport({ bounds: wide, nodes: [], width: WIDTH, height: HEIGHT }).zoom).toBeLessThan(
      READABLE_MIN_ZOOM,
    );
  });

  it('does not zoom in past the pages own size for a small graph', () => {
    const small = { x: 0, y: 0, width: 200, height: 100 };
    expect(fitAllViewport({ bounds: small, nodes: [], width: WIDTH, height: HEIGHT }).zoom).toBe(INITIAL_FIT_MAX_ZOOM);
  });

  it('keeps every node clear of the legend in the top left', () => {
    const legend = { right: 220, bottom: 330 };
    const plain = fitAllViewport({ bounds, nodes, width: WIDTH, height: HEIGHT });
    expect(screen(plain, topLeft).left).toBeLessThan(legend.right);
    expect(screen(plain, topLeft).top).toBeLessThan(legend.bottom);

    const view = fitAllViewport({ bounds, nodes, width: WIDTH, height: HEIGHT, legend });
    for (const n of nodes) {
      const at = screen(view, n);
      expect(at.left >= legend.right || at.top >= legend.bottom).toBe(true);
      expect(at.right).toBeLessThanOrEqual(WIDTH);
      expect(at.bottom).toBeLessThanOrEqual(HEIGHT);
    }
  });

  it('frames every node between the drawers laid over the pane', () => {
    const insets = { left: 300, right: 200 };
    const view = fitAllViewport({ bounds, nodes, width: WIDTH, height: HEIGHT, insets });
    for (const n of nodes) {
      const at = screen(view, n);
      expect(at.left).toBeGreaterThanOrEqual(insets.left);
      expect(at.right).toBeLessThanOrEqual(WIDTH - insets.right);
    }
  });

  it('fits the whole pane when the drawers are wider than it', () => {
    const narrow = 600;
    const insets = { left: 296, right: 392 };
    expect(fitAllViewport({ bounds, nodes, width: narrow, height: HEIGHT, insets })).toEqual(
      fitAllViewport({ bounds, nodes, width: narrow, height: HEIGHT }),
    );
  });

  it('leaves the fit alone when nothing is under the legend', () => {
    const legend = { right: 10, bottom: 10 };
    expect(fitAllViewport({ bounds, nodes, width: WIDTH, height: HEIGHT, legend })).toEqual(
      fitAllViewport({ bounds, nodes, width: WIDTH, height: HEIGHT }),
    );
  });
});
