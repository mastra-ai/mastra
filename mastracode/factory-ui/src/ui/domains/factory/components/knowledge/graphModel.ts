/**
 * Pure graph-model logic for the knowledge page: payload → React Flow
 * nodes/edges, degree-based node sizing (Amendment A3), and the rung/pin
 * filters. Kept free of React/DOM so it unit-tests without a renderer.
 */

import type { Edge, Node } from '@xyflow/react';

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphItem,
  KnowledgeGraphNode,
  KnowledgeRung,
} from '../../services/knowledge';

export const NODE_SIZE_MIN = 52;
export const NODE_SIZE_MAX = 176;
/** Unlabeled leaf nodes (no incoming items) render as small dots. */
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
 * A node earns its label by being referenced: no incoming items means the
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
  /** Show only pin-accented nodes (and edges between them). */
  pinnedOnly: boolean;
}

export const NO_FILTERS: KnowledgeGraphFilters = { rungs: new Set(), pinnedOnly: false };

export function filterGraph(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  filters: KnowledgeGraphFilters,
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  // A9: pins live on nodes (single-target pins) AND edges (relationship
  // pins) — the pin filter keeps both kinds' nodes.
  const pinnedEdgeIds = new Set<string>();
  for (const edge of edges) {
    if (edge.pinned) {
      pinnedEdgeIds.add(edge.source);
      pinnedEdgeIds.add(edge.target);
    }
  }
  const keep = (node: KnowledgeGraphNode): boolean => {
    if (filters.rungs.size > 0 && !filters.rungs.has(node.rung)) return false;
    if (filters.pinnedOnly && !node.pinned && !pinnedEdgeIds.has(node.id)) return false;
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
  items?: KnowledgeGraphItem[],
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const keep = new Set([focusId]);
  const keptEdges = edges.filter(edge => edge.source === focusId || edge.target === focusId);
  for (const edge of keptEdges) {
    keep.add(edge.source);
    keep.add(edge.target);
  }
  // A knowledge item's whole node set is one neighborhood: a junction item that
  // touches the focus must keep ALL its nodes, or the item element gets
  // dropped downstream (its nodes no longer all survive) and a neighbor
  // strands with no visible connection.
  for (const item of items ?? []) {
    if (item.nodeIds.includes(focusId)) for (const id of item.nodeIds) keep.add(id);
  }
  return {
    nodes: nodes.filter(node => keep.has(node.id)),
    edges: edges.filter(edge => keep.has(edge.source) && keep.has(edge.target)),
  };
}

/** A11: items render by arity — tiny dots, connecting lines, junctions. */
export const ITEM_DOT_SIZE = 14;
export const ITEM_JUNCTION_SIZE = 12;
/** Pinned item markers are the pin chip itself — sized so it fits. */
export const ITEM_PIN_SIZE = 22;

export interface ItemNodeElement {
  id: string;
  item: KnowledgeGraphItem;
  /** 'dot' anchors a single-node item; 'junction' splits a 2+-node one. */
  kind: 'dot' | 'junction';
  size: number;
}

export interface ItemEdgeElement {
  id: string;
  /** Always a node id, so page click handlers can treat it as the owner. */
  source: string;
  /** An node id (plain line) or a knowledge item node id (stub/spoke). */
  target: string;
  item: KnowledgeGraphItem;
}

/**
 * A11 derivation: items (already filtered to visible nodes) become
 * graph elements by arity:
 * - 1 node  → a tiny dot + stub edge hugging its node. Suppressed when
 *   the unpinned item is its node's only windowed item — the node
 *   circle already represents it (the flyout shows it on click).
 * - 2 nodes, unpinned → the connecting line (the item IS the edge).
 * - 2 nodes, pinned → a midpoint junction (the pin chip) + two spokes, so
 *   the collision forces keep the chip clear of other nodes.
 * - 3+ nodes → a junction node splitting to each node.
 * Dot/stub/line/junction all carry the item — clicking any of them is
 * clicking the item.
 */
export function deriveItemElements(
  nodes: KnowledgeGraphNode[],
  items: KnowledgeGraphItem[],
): { itemNodes: ItemNodeElement[]; itemEdges: ItemEdgeElement[] } {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const itemNodes: ItemNodeElement[] = [];
  const itemEdges: ItemEdgeElement[] = [];
  for (const item of items) {
    if (item.nodeIds.length === 0) continue;
    if (!item.nodeIds.every(id => byId.has(id))) continue;
    const nodeId = `item:${item.id}`;
    if (item.nodeIds.length === 1) {
      const owner = byId.get(item.nodeIds[0]!)!;
      if (!item.pinned && owner.itemCount === 1) continue; // the circle IS the item
      itemNodes.push({
        id: nodeId,
        item,
        kind: 'dot',
        size: item.pinned ? ITEM_PIN_SIZE : ITEM_DOT_SIZE,
      });
      itemEdges.push({ id: `${nodeId}:stub`, source: owner.id, target: nodeId, item });
      continue;
    }
    if (item.nodeIds.length === 2 && !item.pinned) {
      itemEdges.push({ id: nodeId, source: item.nodeIds[0]!, target: item.nodeIds[1]!, item });
      continue;
    }
    itemNodes.push({
      id: nodeId,
      item,
      kind: 'junction',
      size: item.pinned ? ITEM_PIN_SIZE : ITEM_JUNCTION_SIZE,
    });
    for (const [index, relatedNodeId] of item.nodeIds.entries()) {
      itemEdges.push({ id: `${nodeId}:${index}`, source: relatedNodeId, target: nodeId, item });
    }
  }
  return { itemNodes, itemEdges };
}

/**
 * Logical owner→target pairs for degree sizing and filter/ego traversal —
 * one pseudo-edge per item connection (per-item, so repeated links between
 * the same nodes count toward importance).
 */
export function itemPairEdges(items: KnowledgeGraphItem[]): KnowledgeGraphEdge[] {
  const edges: KnowledgeGraphEdge[] = [];
  for (const item of items) {
    for (let i = 1; i < item.nodeIds.length; i += 1) {
      edges.push({
        id: `pair:${item.id}:${i}`,
        source: item.nodeIds[0]!,
        target: item.nodeIds[i]!,
        type: 'wikilink',
        itemId: item.id,
        pinned: item.pinned || undefined,
      });
    }
  }
  return edges;
}

export type NodeFlowNode = Node<{
  node: KnowledgeGraphNode;
  size: number;
  degree: NodeDegree;
  /** Ego focus: the focused node always renders at max size WITH its label. */
  focused: boolean;
}>;

export type ItemFlowNode = Node<{
  item: KnowledgeGraphItem;
  kind: 'dot' | 'junction';
  size: number;
  /** The item currently selected (its item is open in the flyout). */
  focused?: boolean;
}>;

export type KnowledgeFlowEdge = Edge<{
  itemId: string;
  linkType: 'wikilink';
  pinned: boolean;
  text?: string;
  /** The edge belongs to the item currently selected in the flyout. */
  focused?: boolean;
}>;

/** Map A11 item elements into React Flow nodes/edges (positions from the layout). */
export function toItemFlow(
  itemNodes: ItemNodeElement[],
  itemEdges: ItemEdgeElement[],
  positions?: ReadonlyMap<string, { x: number; y: number }>,
): { nodes: ItemFlowNode[]; edges: KnowledgeFlowEdge[] } {
  return {
    nodes: itemNodes.map(element => {
      const center = positions?.get(element.id);
      const position = center ? { x: center.x - element.size / 2, y: center.y - element.size / 2 } : { x: 0, y: 0 };
      return {
        id: element.id,
        type: 'knowledgeItem',
        position,
        width: element.size,
        height: element.size,
        data: { item: element.item, kind: element.kind, size: element.size },
      } satisfies ItemFlowNode;
    }),
    edges: itemEdges.map(element => ({
      id: element.id,
      source: element.source,
      target: element.target,
      type: 'knowledgeLink',
      data: {
        itemId: element.item.id,
        linkType: 'wikilink' as const,
        pinned: element.item.pinned,
        text: element.item.text,
      },
    })),
  };
}

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
): { nodes: NodeFlowNode[]; edges: KnowledgeFlowEdge[] } {
  const degrees = degreeMap(edges);
  let maxWeighted = 0;
  for (const node of nodes) {
    const degree = degrees.get(node.id);
    if (degree && degree.incoming >= 1) maxWeighted = Math.max(maxWeighted, weightedDegree(degree));
  }
  return {
    nodes: nodes.map(node => {
      const degree = degrees.get(node.id) ?? { incoming: 0, outgoing: 0 };
      const focused = node.id === focusId;
      const size = focused ? NODE_SIZE_MAX : nodeSize(degree, maxWeighted);
      // The force layout positions circle CENTERS; React Flow positions the
      // node's TOP-LEFT corner — convert here or differently-sized nodes skew
      // into each other (the sim thinks they're apart, the render stacks them).
      const center = positions?.get(node.id);
      const position = center ? { x: center.x - size / 2, y: center.y - size / 2 } : { x: 0, y: 0 };
      return {
        id: node.id,
        type: 'knowledgeNode',
        position,
        // Explicit dims so fitView and the minimap know the node size before
        // the DOM measures it.
        width: size,
        height: size,
        data: { node, size, degree, focused },
      } satisfies NodeFlowNode;
    }),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'knowledgeLink',
      data: { itemId: edge.itemId, linkType: edge.type, pinned: edge.pinned ?? false },
    })),
  };
}
