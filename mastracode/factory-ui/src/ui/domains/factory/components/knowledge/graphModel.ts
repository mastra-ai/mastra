/**
 * Pure graph-model logic for the knowledge page: payload → React Flow
 * nodes/edges, degree-based node sizing (Amendment A3), and the rung/pin
 * filters. Kept free of React/DOM so it unit-tests without a renderer.
 */

import type { Edge, Node } from '@xyflow/react';

import type { KnowledgeGraphEdge, KnowledgeGraphMemory, KnowledgeGraphNode, KnowledgeRung } from '../../services/knowledge';

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
  // A9: pins live on nodes (single-target pins) AND edges (relationship
  // pins) — the pin filter keeps both kinds' entities.
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
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
  const keep = new Set([focusId]);
  const keptEdges = edges.filter(edge => edge.source === focusId || edge.target === focusId);
  for (const edge of keptEdges) {
    keep.add(edge.source);
    keep.add(edge.target);
  }
  return { nodes: nodes.filter(node => keep.has(node.id)), edges: keptEdges };
}

/** A11: memories render by arity — tiny dots, connecting lines, junctions. */
export const MEMORY_DOT_SIZE = 14;
export const MEMORY_JUNCTION_SIZE = 12;
/** Pinned memory markers are the pin chip itself — sized so it fits. */
export const MEMORY_PIN_SIZE = 22;

export interface MemoryNodeElement {
  id: string;
  memory: KnowledgeGraphMemory;
  /** 'dot' anchors a single-entity memory; 'junction' splits a 2+-entity one. */
  kind: 'dot' | 'junction';
  size: number;
}

export interface MemoryEdgeElement {
  id: string;
  /** Always an entity id, so page click handlers can treat it as the owner. */
  source: string;
  /** An entity id (plain line) or a memory node id (stub/spoke). */
  target: string;
  memory: KnowledgeGraphMemory;
}

/**
 * A11 derivation: memories (already filtered to visible entities) become
 * graph elements by arity:
 * - 1 entity  → a tiny dot + stub edge hugging its entity. Suppressed when
 *   the unpinned memory is its entity's only windowed fact — the entity
 *   circle already represents it (the flyout shows it on click).
 * - 2 entities, unpinned → the connecting line (the memory IS the edge).
 * - 2 entities, pinned → a midpoint junction (the pin chip) + two spokes, so
 *   the collision forces keep the chip clear of other nodes.
 * - 3+ entities → a junction node splitting to each entity.
 * Dot/stub/line/junction all carry the memory — clicking any of them is
 * clicking the memory.
 */
export function deriveMemoryElements(
  entities: KnowledgeGraphNode[],
  memories: KnowledgeGraphMemory[],
): { memoryNodes: MemoryNodeElement[]; memoryEdges: MemoryEdgeElement[] } {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const memoryNodes: MemoryNodeElement[] = [];
  const memoryEdges: MemoryEdgeElement[] = [];
  for (const memory of memories) {
    if (memory.entityIds.length === 0) continue;
    if (!memory.entityIds.every(id => byId.has(id))) continue;
    const nodeId = `mem:${memory.id}`;
    if (memory.entityIds.length === 1) {
      const owner = byId.get(memory.entityIds[0]!)!;
      if (!memory.pinned && owner.factCount === 1) continue; // the circle IS the memory
      memoryNodes.push({
        id: nodeId,
        memory,
        kind: 'dot',
        size: memory.pinned ? MEMORY_PIN_SIZE : MEMORY_DOT_SIZE,
      });
      memoryEdges.push({ id: `${nodeId}:stub`, source: owner.id, target: nodeId, memory });
      continue;
    }
    if (memory.entityIds.length === 2 && !memory.pinned) {
      memoryEdges.push({ id: nodeId, source: memory.entityIds[0]!, target: memory.entityIds[1]!, memory });
      continue;
    }
    memoryNodes.push({
      id: nodeId,
      memory,
      kind: 'junction',
      size: memory.pinned ? MEMORY_PIN_SIZE : MEMORY_JUNCTION_SIZE,
    });
    for (const [index, entityId] of memory.entityIds.entries()) {
      memoryEdges.push({ id: `${nodeId}:${index}`, source: entityId, target: nodeId, memory });
    }
  }
  return { memoryNodes, memoryEdges };
}

/**
 * Logical owner→target pairs for degree sizing and filter/ego traversal —
 * one pseudo-edge per memory connection (per-fact, so repeated links between
 * the same entities count toward importance).
 */
export function memoryPairEdges(memories: KnowledgeGraphMemory[]): KnowledgeGraphEdge[] {
  const edges: KnowledgeGraphEdge[] = [];
  for (const memory of memories) {
    for (let i = 1; i < memory.entityIds.length; i += 1) {
      edges.push({
        id: `pair:${memory.id}:${i}`,
        source: memory.entityIds[0]!,
        target: memory.entityIds[i]!,
        type: 'wikilink',
        factId: memory.id,
        pinned: memory.pinned || undefined,
      });
    }
  }
  return edges;
}

export type EntityFlowNode = Node<{
  entity: KnowledgeGraphNode;
  size: number;
  degree: NodeDegree;
  /** Ego focus: the focused node always renders at max size WITH its label. */
  focused: boolean;
}>;

export type MemoryFlowNode = Node<{
  memory: KnowledgeGraphMemory;
  kind: 'dot' | 'junction';
  size: number;
  /** The memory currently selected (its fact is open in the flyout). */
  focused?: boolean;
}>;

export type KnowledgeFlowEdge = Edge<{
  factId: string;
  linkType: 'wikilink';
  pinned: boolean;
  text?: string;
  /** The edge belongs to the memory currently selected in the flyout. */
  focused?: boolean;
}>;

/** Map A11 memory elements into React Flow nodes/edges (positions from the layout). */
export function toMemoryFlow(
  memoryNodes: MemoryNodeElement[],
  memoryEdges: MemoryEdgeElement[],
  positions?: ReadonlyMap<string, { x: number; y: number }>,
): { nodes: MemoryFlowNode[]; edges: KnowledgeFlowEdge[] } {
  return {
    nodes: memoryNodes.map(element => {
      const center = positions?.get(element.id);
      const position = center
        ? { x: center.x - element.size / 2, y: center.y - element.size / 2 }
        : { x: 0, y: 0 };
      return {
        id: element.id,
        type: 'knowledgeMemory',
        position,
        width: element.size,
        height: element.size,
        data: { memory: element.memory, kind: element.kind, size: element.size },
      } satisfies MemoryFlowNode;
    }),
    edges: memoryEdges.map(element => ({
      id: element.id,
      source: element.source,
      target: element.target,
      type: 'knowledgeLink',
      data: {
        factId: element.memory.id,
        linkType: 'wikilink' as const,
        pinned: element.memory.pinned,
        text: element.memory.text,
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
      data: { factId: edge.factId, linkType: edge.type, pinned: edge.pinned ?? false },
    })),
  };
}
