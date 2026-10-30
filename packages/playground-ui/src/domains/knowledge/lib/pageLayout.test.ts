import { describe, expect, it } from 'vitest';

import { runLayout } from './layout';
import { layoutPageGraph } from './pageLayout';

function graph(count: number) {
  const nodes = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, size: index === 0 ? 124 : 108 }));
  const edges = nodes.slice(1).map((node, index) => ({ source: `p${Math.floor(index / 8)}`, target: node.id }));
  return { nodes, edges };
}

type Point = { x: number; y: number };
const distance = (a: Point | undefined, b: Point | undefined) =>
  a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Number.POSITIVE_INFINITY;

describe('layoutPageGraph', () => {
  it('lays out the first graph exactly as a cold layout', () => {
    const { nodes, edges } = graph(30);
    expect(layoutPageGraph(undefined, nodes, edges).positions).toEqual(runLayout(nodes, edges));
  });

  it('returns the previous layout untouched when nothing in the graph changed', () => {
    const { nodes, edges } = graph(30);
    const first = layoutPageGraph(undefined, nodes, edges);
    // A refetch hands back fresh arrays in another order.
    const again = layoutPageGraph(
      first,
      [...nodes].reverse().map(node => ({ ...node })),
      [...edges].reverse(),
    );
    expect(again).toBe(first);
  });

  it('keeps placed pages near where they sat when a page is added', () => {
    const { nodes, edges } = graph(60);
    const first = layoutPageGraph(undefined, nodes, edges);
    const next = layoutPageGraph(
      first,
      [...nodes, { id: 'new', size: 108 }],
      [...edges, { source: 'p3', target: 'new' }],
    );
    const moved = nodes.map(node => distance(first.positions.get(node.id), next.positions.get(node.id)));
    // Only pages the new one lands on make room; most don't move at all.
    expect(moved.filter(px => px > 1).length).toBeLessThan(nodes.length / 4);
    expect(Math.max(...moved)).toBeLessThan(108);
    expect(distance(next.positions.get('new'), first.positions.get('p3'))).toBeLessThan(400);
  });

  it('lays out from scratch when most pages are new', () => {
    const small = graph(4);
    const first = layoutPageGraph(undefined, small.nodes, small.edges);
    const big = graph(30);
    expect(layoutPageGraph(first, big.nodes, big.edges).positions).toEqual(runLayout(big.nodes, big.edges));
  });
});
