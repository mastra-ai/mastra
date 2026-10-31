import { runLayout } from './layout';
import type { LayoutEdgeInput } from './layout';

type Point = { x: number; y: number };

export interface PageLayout {
  /** Node ids, sizes and edges the positions were solved for. */
  key: string;
  positions: Map<string, Point>;
}

/** Below this share of already-placed nodes the graph is laid out from scratch. */
const WARM_SHARE = 0.5;

function layoutKey(nodes: { id: string; size: number }[], edges: LayoutEdgeInput[]): string {
  const nodePart = nodes.map(node => `${node.id}:${node.size}`).sort();
  const edgePart = edges.map(edge => `${edge.source}>${edge.target}`).sort();
  return `${nodePart.join(',')}|${edgePart.join(',')}`;
}

/**
 * Lays out the page graph, reusing the previous layout. The same nodes and
 * edges return the previous positions as they are, so a refetch or live update
 * that changes nothing in the graph never moves a node or re-runs the solve.
 * When most nodes were already placed, they start where they sat, new pages
 * start beside a placed neighbour, and a short run only pushes apart pages that
 * overlap, so the rest stay put.
 * Otherwise the layout is solved from the deterministic cold start.
 */
export function layoutPageGraph(
  previous: PageLayout | undefined,
  nodes: { id: string; size: number }[],
  edges: LayoutEdgeInput[],
): PageLayout {
  const key = layoutKey(nodes, edges);
  if (previous?.key === key) return previous;

  const last = previous?.positions;
  const known = last ? nodes.filter(node => last.has(node.id)).length : 0;
  if (!last || nodes.length === 0 || known / nodes.length < WARM_SHARE) {
    return { key, positions: runLayout(nodes, edges) };
  }

  const besideNeighbour = (id: string): Point | undefined => {
    for (const edge of edges) {
      const other = edge.source === id ? edge.target : edge.target === id ? edge.source : undefined;
      const at = other ? last.get(other) : undefined;
      if (at) return { x: at.x + 40, y: at.y + 40 };
    }
    return undefined;
  };
  // No force ticks: any force run drifts a settled layout. Only the overlap
  // pass runs, pushing apart the pages a new page landed on.
  const positions = runLayout(
    nodes.map(node => ({ ...node, initial: last.get(node.id) ?? besideNeighbour(node.id) })),
    edges,
    { ticks: 0 },
  );
  return { key, positions };
}
