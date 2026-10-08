import type { KnowledgeGraphPayload } from '../../services/knowledge';
import { deriveRecordElements } from './graphModel';
import type { KnowledgeGraphFilters } from './graphModel';
import { getVisibleKnowledgeIds } from './knowledgeScene';

/** Update presentation attributes without replacing CSS or touching graph state. */
export function applyKnowledgePresentation(
  canvas: HTMLElement,
  payload: KnowledgeGraphPayload,
  filters: KnowledgeGraphFilters,
  selection: { nodeId?: string; recordId?: string },
) {
  const changes: { element: Element; hidden: boolean }[] = [];
  function queueVisibility(element: Element, hidden: boolean) {
    if (!hidden) element.removeAttribute('data-knowledge-hidden-settled');
    if (element.hasAttribute('data-knowledge-hidden') !== hidden) changes.push({ element, hidden });
  }
  // A node click moves the camera through the existing scene. Keep its context
  // visible; only explicit scope/pin filters change graph visibility.
  const visibleIds = getVisibleKnowledgeIds(payload, filters);
  const records = payload.records ?? [];
  const edges = records.length > 0 ? deriveRecordElements(payload.nodes, records).recordEdges : payload.edges;
  const visibleEdges = new Set(
    edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map(edge => edge.id),
  );

  for (const node of canvas.querySelectorAll<HTMLElement>('.react-flow__node')) {
    const id = node.dataset.id ?? '';
    queueVisibility(node, !visibleIds.has(id));
    node.toggleAttribute('data-knowledge-focused', id === selection.nodeId);
  }
  for (const edge of canvas.querySelectorAll<SVGGElement>('.react-flow__edge')) {
    queueVisibility(edge, !visibleEdges.has(edge.dataset.id ?? ''));
  }
  for (const badge of canvas.querySelectorAll<HTMLElement>('[data-knowledge-edge-id]')) {
    queueVisibility(badge, !visibleEdges.has(badge.dataset.knowledgeEdgeId ?? ''));
  }
  for (const record of canvas.querySelectorAll<HTMLElement>('[data-record-id]')) {
    record.toggleAttribute('data-knowledge-record-focus', record.dataset.recordId === selection.recordId);
  }
  for (const path of canvas.querySelectorAll<SVGPathElement>('[data-knowledge-record-id]')) {
    path.toggleAttribute('data-knowledge-record-focus', path.dataset.knowledgeRecordId === selection.recordId);
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let index = 0;
  let frame: number | undefined;
  function applyBatch() {
    const end = reducedMotion ? changes.length : Math.min(index + 80, changes.length);
    for (; index < end; index++) {
      const change = changes[index]!;
      change.element.toggleAttribute('data-knowledge-hidden', change.hidden);
      change.element.toggleAttribute('inert', change.hidden);
      if (change.element instanceof SVGElement) change.element.setAttribute('tabindex', change.hidden ? '-1' : '0');
      if (reducedMotion) change.element.toggleAttribute('data-knowledge-hidden-settled', change.hidden);
    }
    if (index < changes.length) frame = requestAnimationFrame(applyBatch);
  }
  // Stagger dense scenes in small batches rather than allocating hundreds of
  // simultaneous CSS animations in the click frame. No layout/positions change.
  if (changes.length > 0) frame = requestAnimationFrame(applyBatch);
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}
