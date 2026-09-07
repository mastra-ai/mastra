/**
 * Pure graph-model logic for the knowledge page: payload → React Flow
 * nodes/edges, degree-based node sizing (Amendment A3), and the rung/pin
 * filters. Kept free of React/DOM so it unit-tests without a renderer.
 */

import type { Edge, Node } from '@xyflow/react';

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphRecord,
  KnowledgeGraphNode,
  KnowledgeRung,
} from '../../services/knowledge';

export const NODE_SIZE_MIN = 52;
export const NODE_SIZE_MAX = 176;
/** Unlabeled leaf nodes (no incoming records) render as small dots. */
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
 * A node earns its label by being referenced: no incoming records means the
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
  records?: KnowledgeGraphRecord[],
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const keep = new Set([focusId]);
  const keptEdges = edges.filter(edge => edge.source === focusId || edge.target === focusId);
  for (const edge of keptEdges) {
    keep.add(edge.source);
    keep.add(edge.target);
  }
  // A knowledge record's whole node set is one neighborhood: a junction record that
  // touches the focus must keep ALL its nodes, or the record element gets
  // dropped downstream (its nodes no longer all survive) and a neighbor
  // strands with no visible connection.
  for (const record of records ?? []) {
    if (record.nodeIds.includes(focusId)) for (const id of record.nodeIds) keep.add(id);
  }
  return {
    nodes: nodes.filter(node => keep.has(node.id)),
    edges: edges.filter(edge => keep.has(edge.source) && keep.has(edge.target)),
  };
}

/** A11: records render by arity — tiny dots, connecting lines, junctions. */
export const RECORD_DOT_SIZE = 14;
export const RECORD_JUNCTION_SIZE = 12;
/** Pinned record markers are the pin chip itself — sized so it fits. */
export const RECORD_PIN_SIZE = 22;

export interface RecordNodeElement {
  id: string;
  record: KnowledgeGraphRecord;
  /** 'dot' anchors a single-node record; 'junction' splits a 2+-node one. */
  kind: 'dot' | 'junction';
  size: number;
}

export interface RecordEdgeElement {
  id: string;
  /** Always a node id, so page click handlers can treat it as the owner. */
  source: string;
  /** An node id (plain line) or a knowledge record node id (stub/spoke). */
  target: string;
  record: KnowledgeGraphRecord;
}

/**
 * A11 derivation: records (already filtered to visible nodes) become
 * graph elements by arity:
 * - 1 node  → a tiny dot + stub edge hugging its node. Suppressed when
 *   the unpinned record is its node's only windowed record — the node
 *   circle already represents it (the flyout shows it on click).
 * - 2 nodes, unpinned → the connecting line (the record IS the edge).
 * - 2 nodes, pinned → a midpoint junction (the pin chip) + two spokes, so
 *   the collision forces keep the chip clear of other nodes.
 * - 3+ nodes → a junction node splitting to each node.
 * Dot/stub/line/junction all carry the record — clicking any of them is
 * clicking the record.
 */
export function deriveRecordElements(
  nodes: KnowledgeGraphNode[],
  records: KnowledgeGraphRecord[],
): { recordNodes: RecordNodeElement[]; recordEdges: RecordEdgeElement[] } {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const recordNodes: RecordNodeElement[] = [];
  const recordEdges: RecordEdgeElement[] = [];
  for (const record of records) {
    if (record.nodeIds.length === 0) continue;
    if (!record.nodeIds.every(id => byId.has(id))) continue;
    const nodeId = `record:${record.id}`;
    if (record.nodeIds.length === 1) {
      const owner = byId.get(record.nodeIds[0]!)!;
      if (!record.pinned && owner.recordCount === 1) continue; // the circle represents the record
      recordNodes.push({
        id: nodeId,
        record,
        kind: 'dot',
        size: record.pinned ? RECORD_PIN_SIZE : RECORD_DOT_SIZE,
      });
      recordEdges.push({ id: `${nodeId}:stub`, source: owner.id, target: nodeId, record });
      continue;
    }
    if (record.nodeIds.length === 2 && !record.pinned) {
      recordEdges.push({ id: nodeId, source: record.nodeIds[0]!, target: record.nodeIds[1]!, record });
      continue;
    }
    recordNodes.push({
      id: nodeId,
      record,
      kind: 'junction',
      size: record.pinned ? RECORD_PIN_SIZE : RECORD_JUNCTION_SIZE,
    });
    for (const [index, relatedNodeId] of record.nodeIds.entries()) {
      recordEdges.push({ id: `${nodeId}:${index}`, source: relatedNodeId, target: nodeId, record });
    }
  }
  return { recordNodes, recordEdges };
}

/**
 * Logical owner→target pairs for degree sizing and filter/ego traversal —
 * one pseudo-edge per record connection (per-record, so repeated links between
 * the same nodes count toward importance).
 */
export function recordPairEdges(records: KnowledgeGraphRecord[]): KnowledgeGraphEdge[] {
  const edges: KnowledgeGraphEdge[] = [];
  for (const record of records) {
    for (let i = 1; i < record.nodeIds.length; i += 1) {
      edges.push({
        id: `pair:${record.id}:${i}`,
        source: record.nodeIds[0]!,
        target: record.nodeIds[i]!,
        type: 'wikilink',
        recordId: record.id,
        pinned: record.pinned || undefined,
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

export type RecordFlowNode = Node<{
  record: KnowledgeGraphRecord;
  kind: 'dot' | 'junction';
  size: number;
  /** The record currently selected (its record is open in the flyout). */
  focused?: boolean;
}>;

export type KnowledgeFlowEdge = Edge<{
  recordId: string;
  linkType: 'wikilink';
  pinned: boolean;
  text?: string;
  /** The edge belongs to the record currently selected in the flyout. */
  focused?: boolean;
}>;

/** Map A11 record elements into React Flow nodes/edges (positions from the layout). */
export function toRecordFlow(
  recordNodes: RecordNodeElement[],
  recordEdges: RecordEdgeElement[],
  positions?: ReadonlyMap<string, { x: number; y: number }>,
): { nodes: RecordFlowNode[]; edges: KnowledgeFlowEdge[] } {
  return {
    nodes: recordNodes.map(element => {
      const center = positions?.get(element.id);
      const position = center ? { x: center.x - element.size / 2, y: center.y - element.size / 2 } : { x: 0, y: 0 };
      return {
        id: element.id,
        type: 'knowledgeRecord',
        position,
        width: element.size,
        height: element.size,
        data: { record: element.record, kind: element.kind, size: element.size },
      } satisfies RecordFlowNode;
    }),
    edges: recordEdges.map(element => ({
      id: element.id,
      source: element.source,
      target: element.target,
      type: 'knowledgeLink',
      data: {
        recordId: element.record.id,
        linkType: 'wikilink' as const,
        pinned: element.record.pinned,
        text: element.record.text,
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
      data: { recordId: edge.recordId, linkType: edge.type, pinned: edge.pinned ?? false },
    })),
  };
}
