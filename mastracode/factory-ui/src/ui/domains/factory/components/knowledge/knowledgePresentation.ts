import type { KnowledgeGraphPayload } from '../../services/knowledge';
import { deriveRecordElements } from './graphModel';
import type { KnowledgeGraphFilters } from './graphModel';
import { getVisibleKnowledgeIds } from './knowledgeScene';
import { animateKnowledgeVisibility } from './knowledgeVisibilityMotion';

/** Update presentation attributes without replacing CSS or touching graph state. */
export function applyKnowledgePresentation(
  canvas: HTMLElement,
  payload: KnowledgeGraphPayload,
  filters: KnowledgeGraphFilters,
  selection: { nodeId?: string; recordId?: string },
) {
  const visibility: { element: HTMLElement | SVGElement; hidden: boolean }[] = [];
  // Focus uses the existing neighborhood derivation; the full scene stays mounted.
  const visibleIds = getVisibleKnowledgeIds(payload, filters, selection.nodeId);
  const records = payload.records ?? [];
  const edges = records.length > 0 ? deriveRecordElements(payload.nodes, records).recordEdges : payload.edges;
  const visibleEdges = new Set(
    edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map(edge => edge.id),
  );

  for (const node of canvas.querySelectorAll<HTMLElement>('.react-flow__node')) {
    const id = node.dataset.id ?? '';
    visibility.push({ element: node, hidden: !visibleIds.has(id) });
    node.toggleAttribute('data-knowledge-focused', id === selection.nodeId);
  }
  for (const edge of canvas.querySelectorAll<SVGGElement>('.react-flow__edge')) {
    visibility.push({ element: edge, hidden: !visibleEdges.has(edge.dataset.id ?? '') });
  }
  for (const badge of canvas.querySelectorAll<HTMLElement>('[data-knowledge-edge-id]')) {
    visibility.push({ element: badge, hidden: !visibleEdges.has(badge.dataset.knowledgeEdgeId ?? '') });
  }
  for (const record of canvas.querySelectorAll<HTMLElement>('[data-record-id]')) {
    record.toggleAttribute('data-knowledge-record-focus', record.dataset.recordId === selection.recordId);
  }
  for (const path of canvas.querySelectorAll<SVGPathElement>('[data-knowledge-record-id]')) {
    path.toggleAttribute('data-knowledge-record-focus', path.dataset.knowledgeRecordId === selection.recordId);
  }
  return animateKnowledgeVisibility(canvas, visibility);
}
