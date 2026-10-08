import type { KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import { deriveRecordElements, egoGraph, filterGraph, recordPairEdges, toFlowGraph, toRecordFlow } from './graphModel';
import type { KnowledgeFlowEdge, KnowledgeGraphFilters } from './graphModel';
import { isKnowledgeNode, isRecordNode } from './knowledgeStyles';
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

function sceneClassName(visible: boolean, arrived: boolean): string | undefined {
  if (!visible) return 'knowledge-excluded';
  if (arrived) return 'knowledge-arrive';
  return undefined;
}

export function presentKnowledgeNodes(
  nodes: KnowledgeFlowNode[],
  visibleIds: ReadonlySet<string>,
  selection: { nodeId?: string; recordId?: string },
  arrivals?: Arrivals,
): KnowledgeFlowNode[] {
  return nodes.map(node => {
    const visible = visibleIds.has(node.id);
    const focused = isKnowledgeNode(node) ? node.id === selection.nodeId : node.data.record.id === selection.recordId;
    const className = sceneClassName(visible, arrivals?.nodes.has(node.id) ?? false);
    if (
      node.className === className &&
      Boolean(node.data.focused) === focused &&
      node.focusable === visible &&
      node.selected === focused
    )
      return node;
    const presentation = { className, focusable: visible, selectable: visible, selected: focused };
    if (Boolean(node.data.focused) === focused) return { ...node, ...presentation };
    if (isKnowledgeNode(node)) return { ...node, ...presentation, data: { ...node.data, focused } };
    return { ...node, ...presentation, data: { ...node.data, focused } };
  });
}

export function presentKnowledgeEdges(
  edges: KnowledgeFlowEdge[],
  visibleIds: ReadonlySet<string>,
  recordId?: string,
  arrivals?: Arrivals,
): KnowledgeFlowEdge[] {
  return edges.map(edge => {
    const visible = visibleIds.has(edge.source) && visibleIds.has(edge.target);
    const focused = Boolean(recordId && edge.data?.recordId === recordId);
    const className = sceneClassName(visible, arrivals?.edges.has(edge.id) ?? false);
    if (edge.className === className && Boolean(edge.data?.focused) === focused && edge.focusable === visible)
      return edge;
    const presentation = { className, focusable: visible, selectable: visible };
    if (Boolean(edge.data?.focused) === focused) return { ...edge, ...presentation };
    return { ...edge, ...presentation, data: edge.data ? { ...edge.data, focused } : undefined };
  });
}
