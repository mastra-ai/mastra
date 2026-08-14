/**
 * Synchronous d3-force layout for the knowledge graph. The simulation is run
 * to a fixed tick count with deterministic initial positions (a phyllotaxis
 * spiral over the SORTED node ids), so the same input always yields the same
 * settled layout — that is what makes the layout unit-testable.
 */

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';

export interface LayoutNodeInput {
  id: string;
  /** Node diameter in px (drives collision radius and link distance). */
  size: number;
  /** Pinned position from a user drag — the simulation must not move it. */
  fixed?: { x: number; y: number };
  /** Warm-start position (e.g. spawn a new node near its first neighbor). */
  initial?: { x: number; y: number };
  /** Collision breathing room around the node (default 28; tiny memory dots use less). */
  padding?: number;
}

export interface LayoutEdgeInput {
  source: string;
  target: string;
  /** A11: hug links (memory dot stubs / junction spokes) stay short so memory markers cluster tight. */
  hug?: boolean;
}

const DEFAULT_PADDING = 28;

interface SimNode extends SimulationNodeDatum {
  id: string;
  size: number;
  padding: number;
}

type SimLink = SimulationLinkDatum<SimNode>;

const DEFAULT_TICKS = 300;

export function runLayout(
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  options: { ticks?: number } = {},
): Map<string, { x: number; y: number }> {
  const ticks = options.ticks ?? DEFAULT_TICKS;
  const order = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const simNodes: SimNode[] = order.map((node, index) => {
    // Deterministic phyllotaxis seed (same shape d3 uses internally, but keyed
    // to the sorted index so insertion order never changes the layout).
    const radius = 18 * Math.sqrt(0.5 + index);
    const angle = index * 2.399963229728653;
    const seeded = node.initial ?? { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    return {
      id: node.id,
      size: node.size,
      padding: node.padding ?? DEFAULT_PADDING,
      x: node.fixed?.x ?? seeded.x,
      y: node.fixed?.y ?? seeded.y,
      fx: node.fixed?.x ?? null,
      fy: node.fixed?.y ?? null,
    };
  });
  const ids = new Set(simNodes.map(node => node.id));
  const hugs = new Set(edges.filter(edge => edge.hug).map(edge => `${edge.source}\u0000${edge.target}`));
  const simEdges: SimLink[] = edges
    .filter(edge => ids.has(edge.source) && ids.has(edge.target))
    .map(edge => ({ source: edge.source, target: edge.target }));

  const simulation = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(simEdges)
        .id(node => node.id)
        .distance(link => {
          const source = link.source as SimNode;
          const target = link.target as SimNode;
          // Hug links (memory stubs/spokes) keep markers tight to their cluster.
          const hug = hugs.has(`${source.id}\u0000${target.id}`);
          return (hug ? 8 : 40) + (source.size + target.size) / 2;
        }),
    )
    // Tiny memory markers repel gently; entities keep the strong spread.
    .force('charge', forceManyBody<SimNode>().strength(node => (node.size <= 24 ? -60 : -700)))
    .force(
      'collide',
      forceCollide<SimNode>()
        .radius(node => node.size / 2 + node.padding)
        .strength(1)
        .iterations(3),
    )
    .force('center', forceCenter(0, 0))
    // Weak gravity keeps disconnected satellites in frame instead of flinging
    // them to the edges of the canvas.
    .force('x', forceX(0).strength(0.06))
    .force('y', forceY(0).strength(0.08))
    .stop();

  simulation.tick(ticks);
  resolveOverlaps(simNodes);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of simNodes) {
    // No rounding: a 1px round-off can re-introduce a just-resolved overlap.
    positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }
  return positions;
}

/**
 * Hard guarantee that no two nodes overlap: the force simulation can leave
 * residual overlaps once alpha decays, so after settling we sweep node pairs
 * and push them apart deterministically until every pair clears its combined
 * radius plus padding. Fixed (user-dragged) nodes never move.
 */
function resolveOverlaps(nodes: SimNode[]): void {
  // Sorted big-first: settling the large nodes before the dots converges much
  // faster and avoids ping-pong between hub pairs.
  const order = [...nodes].sort((a, b) => b.size - a.size);
  for (let sweep = 0; sweep < 600; sweep++) {
    let moved = false;
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const a = order[i]!;
        const b = order[j]!;
        // Pair breathing room = the smaller of the two paddings, so tiny
        // memory markers can nestle close without entities colliding.
        const minDistance = a.size / 2 + b.size / 2 + Math.min(a.padding, b.padding);
        let dx = (b.x ?? 0) - (a.x ?? 0);
        let dy = (b.y ?? 0) - (a.y ?? 0);
        let distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        if (distance === 0) {
          // Perfectly stacked: separate along a deterministic axis.
          dx = 1;
          dy = 0;
          distance = 1;
        }
        // Over-separate slightly so float noise can't re-trigger the pair.
        const overlap = minDistance - distance + 0.5;
        const ux = dx / distance;
        const uy = dy / distance;
        const aFixed = a.fx != null;
        const bFixed = b.fx != null;
        if (aFixed && bFixed) continue;
        const aShare = aFixed ? 0 : bFixed ? 1 : 0.5;
        const bShare = 1 - aShare;
        a.x = (a.x ?? 0) - ux * overlap * aShare;
        a.y = (a.y ?? 0) - uy * overlap * aShare;
        b.x = (b.x ?? 0) + ux * overlap * bShare;
        b.y = (b.y ?? 0) + uy * overlap * bShare;
        moved = true;
      }
    }
    if (!moved) break;
  }
}
