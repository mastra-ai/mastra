/**
 * Pure graph-model logic for the knowledge page: payload → React Flow
 * nodes/edges, degree-based node sizing (Amendment A3), and the rung/pin
 * filters. Kept free of React/DOM so it unit-tests without a renderer.
 */

import type { Edge, Node } from '@xyflow/react';

import type { KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeRung } from '../../services/knowledge';

export const NODE_SIZE_MIN = 52;
export const NODE_SIZE_MAX = 176;
/** Unlabeled leaf nodes (no incoming memories) render as small dots. */
export const NODE_SIZE_DOT = 26;
/** Being pointed AT is what importance means — incoming counts double. */
const INCOMING_WEIGHT = 2;

export interface NodeDegree {
  incoming: number;
  outgoing: number;
}

export function weightedDegree(degree: NodeDegree): number {
  return INCOMING_WEIGHT * degree.incoming + degree.outgoing;
}

/**
 * Amendment A3 + A5 sizing: the most-connected node in the view anchors
 * NODE_SIZE_MAX and everything else scales proportionally to its weighted
 * degree (incoming counts double). Unreferenced nodes are fixed-size dots.
 */
export function nodeSize(degree: NodeDegree, maxWeighted: number): number {
  if (!shouldShowLabel(degree)) return NODE_SIZE_DOT;
  if (maxWeighted <= 0) return NODE_SIZE_MIN;
  const ratio = Math.min(1, weightedDegree(degree) / maxWeighted);
  return Math.round(NODE_SIZE_MIN + (NODE_SIZE_MAX - NODE_SIZE_MIN) * ratio);
}

/**
 * A node earns its label by being referenced: no incoming memories means the
 * label stays hidden (hover/click still surface the details).
 */
export function shouldShowLabel(degree: NodeDegree): boolean {
  return degree.incoming >= 1;
}

export function degreeMap(edges: KnowledgeGraphEdge[]): Map<string, NodeDegree> {
  const degrees = new Map<string, NodeDegree>();
  const of = (id: string): NodeDegree => {
    let entry = degrees.get(id);
    if (!entry) {
      entry = { incoming: 0, outgoing: 0 };
      degrees.set(id, entry);
    }
    return entry;
  };
  for (const edge of edges) {
    of(edge.source).outgoing += 1;
    of(edge.target).incoming += 1;
  }
  return degrees;
}

export interface KnowledgeGraphFilters {
  /** Scope rungs to show; empty set = show all. */
  rungs: ReadonlySet<KnowledgeRung>;
  /** Show only pin-accented entities (and edges between them). */
  pinnedOnly: boolean;
}

export const NO_FILTERS: KnowledgeGraphFilters = { rungs: new Set(), pinnedOnly: false };

export function filterGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  filters: KnowledgeGraphFilters,
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const keep = (node: KnowledgeGraphNode): boolean => {
    if (filters.rungs.size > 0 && !filters.rungs.has(node.rung)) return false;
    if (filters.pinnedOnly && !node.pinned) return false;
    return true;
  };
  const kept = nodes.filter(keep);
  const keptIds = new Set(kept.map(node => node.id));
  return {
    nodes: kept,
    edges: edges.filter(edge => keptIds.has(edge.source) && keptIds.has(edge.target)),
  };
}

/**
 * Ego view: the clicked node plus everything it directly touches. Clicking a
 * node focuses the graph on its neighborhood (Amendment A5).
 */
export function egoGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  focusId: string,
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const keep = new Set([focusId]);
  const keptEdges = edges.filter(edge => edge.source === focusId || edge.target === focusId);
  for (const edge of keptEdges) {
    keep.add(edge.source);
    keep.add(edge.target);
  }
  return { nodes: nodes.filter(node => keep.has(node.id)), edges: keptEdges };
}

export type EntityFlowNode = Node<{
  entity: KnowledgeGraphNode;
  size: number;
  degree: NodeDegree;
  /** Ego focus: the focused node always renders at max size WITH its label. */
  focused: boolean;
}>;

export type KnowledgeFlowEdge = Edge<{ factId: string; linkType: 'wikilink' }>;

/**
 * Map an (already filtered) payload slice into React Flow nodes/edges.
 * Positions default to origin — the force layout assigns them. A focused node
 * (ego view) always renders at max size.
 */
export function toFlowGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  positions?: ReadonlyMap<string, { x: number; y: number }>,
  focusId?: string | null,
): { nodes: EntityFlowNode[]; edges: KnowledgeFlowEdge[] } {
  const degrees = degreeMap(edges);
  let maxWeighted = 0;
  for (const node of nodes) {
    const degree = degrees.get(node.id);
    if (degree && degree.incoming >= 1) maxWeighted = Math.max(maxWeighted, weightedDegree(degree));
  }
  return {
    nodes: nodes.map(entity => {
      const degree = degrees.get(entity.id) ?? { incoming: 0, outgoing: 0 };
      const focused = entity.id === focusId;
      const size = focused ? NODE_SIZE_MAX : nodeSize(degree, maxWeighted);
      // The force layout positions circle CENTERS; React Flow positions the
      // node's TOP-LEFT corner — convert here or differently-sized nodes skew
      // into each other (the sim thinks they're apart, the render stacks them).
      const center = positions?.get(entity.id);
      const position = center ? { x: center.x - size / 2, y: center.y - size / 2 } : { x: 0, y: 0 };
      return {
        id: entity.id,
        type: 'knowledgeEntity',
        position,
        // Explicit dims so fitView and the minimap know the node size before
        // the DOM measures it.
        width: size,
        height: size,
        data: { entity, size, degree, focused },
      } satisfies EntityFlowNode;
    }),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'knowledgeLink',
      data: { factId: edge.factId, linkType: edge.type },
    })),
  };
}
