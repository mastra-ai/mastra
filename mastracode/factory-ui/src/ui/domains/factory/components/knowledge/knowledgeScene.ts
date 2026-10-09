import type { KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import { deriveRecordElements, egoGraph, filterGraph, recordPairEdges, toFlowGraph, toRecordFlow } from './graphModel';
import type { KnowledgeFlowEdge, KnowledgeGraphFilters } from './graphModel';
import { isRecordNode } from './knowledgeStyles';
import type { KnowledgeFlowNode } from './knowledgeStyles';
import { runLayout } from './layout';

export interface KnowledgeScene {
  nodes: KnowledgeFlowNode[];
  edges: KnowledgeFlowEdge[];
}

/** Layout belongs to the data, not to hover, focus, filters or drag events. */
export function createKnowledgeScene(
  payload: KnowledgeGraphPayload,
  current: KnowledgeFlowNode[] = [],
): KnowledgeScene {
  const records = payload.records ?? [];
  const pairs = records.length > 0 ? recordPairEdges(records) : payload.edges;
  const knowledge = toFlowGraph(payload.nodes, pairs);
  const elements = deriveRecordElements(payload.nodes, records);
  const recordFlow = toRecordFlow(elements.recordNodes, elements.recordEdges);
  const nodes: KnowledgeFlowNode[] = [...knowledge.nodes, ...recordFlow.nodes];
  const edges = records.length > 0 ? recordFlow.edges : knowledge.edges;
  const previous = new Map(current.map(node => [node.id, node]));
  const centers = new Map(
    current.map(node => [
      node.id,
      {
        x: node.position.x + node.data.size / 2,
        y: node.position.y + node.data.size / 2,
      },
    ]),
  );

  // Polls with no new layout nodes need no simulation. Existing centers (including
  // dragged nodes) remain fixed when arrivals are placed around their neighbors.
  if (nodes.some(node => !previous.has(node.id))) {
    const positions = runLayout(
      nodes.map(node => {
        const edge = edges.find(edge => edge.source === node.id || edge.target === node.id);
        const neighborId = edge?.source === node.id ? edge.target : edge?.source;
        const anchor = neighborId ? centers.get(neighborId) : undefined;
        return {
          id: node.id,
          size: node.data.size,
          padding: isRecordNode(node) ? 6 : undefined,
          fixed: centers.get(node.id),
          initial: anchor ? { x: anchor.x + 40, y: anchor.y + 40 } : undefined,
        };
      }),
      edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        hug: edge.source.startsWith('record:') || edge.target.startsWith('record:'),
      })),
    );
    for (const [id, position] of positions) centers.set(id, position);
  }

  return {
    nodes: nodes.map(node => {
      const center = centers.get(node.id);
      const existing = previous.get(node.id);
      return {
        ...node,
        // Preserve library-owned selection, measurement and drag state.
        selected: existing?.selected,
        dragging: existing?.dragging,
        measured: existing?.measured,
        width: node.data.size,
        height: node.data.size,
        position: center ? { x: center.x - node.data.size / 2, y: center.y - node.data.size / 2 } : node.position,
      };
    }),
    edges,
  };
}

/** Keep the full scene mounted; visibility changes never change its geometry. */
export function getVisibleKnowledgeIds(
  payload: KnowledgeGraphPayload,
  filters: KnowledgeGraphFilters,
  focusedId?: string,
) {
  const records = payload.records ?? [];
  const pairs = records.length > 0 ? recordPairEdges(records) : payload.edges;
  const filtered = filterGraph(payload.nodes, pairs, filters);
  const hasFocus = focusedId && filtered.nodes.some(node => node.id === focusedId);
  const visible = hasFocus ? egoGraph(filtered.nodes, filtered.edges, focusedId, records) : filtered;
  const elements = deriveRecordElements(visible.nodes, records);
  return new Set([...visible.nodes.map(node => node.id), ...elements.recordNodes.map(node => node.id)]);
}

/** Arrival styling changes only when the domain payload changes, never on selection. */
export function getKnowledgeArrivalScene(scene: KnowledgeScene, arrivals?: Arrivals): KnowledgeScene {
  return {
    nodes: scene.nodes.map(node => {
      const className = arrivals?.nodes.has(node.id) ? 'knowledge-arrive' : undefined;
      return node.className === className ? node : { ...node, className };
    }),
    edges: scene.edges.map(edge => {
      const className = arrivals?.edges.has(edge.id) ? 'knowledge-arrive' : undefined;
      return edge.className === className ? edge : { ...edge, className };
    }),
  };
}
