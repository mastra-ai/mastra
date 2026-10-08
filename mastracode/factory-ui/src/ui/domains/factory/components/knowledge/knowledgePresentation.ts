import type { KnowledgeGraphPayload } from '../../services/knowledge';
import { deriveRecordElements } from './graphModel';
import type { KnowledgeGraphFilters } from './graphModel';
import { getVisibleKnowledgeIds } from './knowledgeScene';

function cssValue(value: string): string {
  // Attribute values are quoted: punctuation and Unicode need no escaping.
  return value
    .replace(/[\\"]/g, '\\$&')
    .replace(/[\u0000-\u001f\u007f<]/gu, character => `\\${(character.codePointAt(0) ?? 0).toString(16)} `);
}

function excludingVisible(attribute: string, ids: string[]): string {
  if (ids.length === 0) return '';
  return `:not(:is(${ids.map(id => `[${attribute}="${cssValue(id)}"]`).join(',')}))`;
}

/** Selection is a CSS presentation change, never a React Flow node/edge update. */
export function getKnowledgePresentation(
  scopeId: string,
  payload: KnowledgeGraphPayload,
  filters: KnowledgeGraphFilters,
  selection: { nodeId?: string; recordId?: string },
): string {
  const scope = `[data-knowledge-scene="${cssValue(scopeId)}"]`;
  const rules: string[] = [];
  if (selection.nodeId || filters.rungs.size > 0 || filters.pinnedOnly) {
    const visibleIds = getVisibleKnowledgeIds(payload, filters, selection.nodeId);
    const records = payload.records ?? [];
    const elements = deriveRecordElements(payload.nodes, records);
    const edges = records.length > 0 ? elements.recordEdges : payload.edges;
    const visibleEdges = edges
      .filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map(edge => edge.id);
    rules.push(`
      ${scope} .react-flow__node${excludingVisible('data-id', [...visibleIds])},
      ${scope} .react-flow__edge${excludingVisible('data-id', visibleEdges)},
      ${scope} [data-knowledge-edge-id]${excludingVisible('data-knowledge-edge-id', visibleEdges)} {
        opacity: 0;
        visibility: hidden !important;
        pointer-events: none !important;
        transition: opacity var(--duration-slow) var(--ease-out-custom), visibility 0s var(--duration-slow);
      }
      @media (prefers-reduced-motion: reduce) {
        ${scope} .react-flow__node, ${scope} .react-flow__edge, ${scope} [data-knowledge-edge-id] { transition: none !important; }
      }
    `);
  }
  if (selection.nodeId) {
    const node = `${scope} .react-flow__node[data-id="${cssValue(selection.nodeId)}"]`;
    rules.push(`
      ${node} .knowledge-circle { border-color: var(--knowledge-color); outline: 2px solid var(--knowledge-color); outline-offset: 5px; }
      ${node} .knowledge-leaf-label { display: block; }
    `);
  }
  if (selection.recordId) {
    const record = `[data-record-id="${cssValue(selection.recordId)}"]`;
    const edge = `${scope} .react-flow__edge-path[data-knowledge-record-id="${cssValue(selection.recordId)}"]`;
    rules.push(`
      ${scope} ${record} { box-shadow: 0 0 0 2px var(--badge-blue-indicator); }
      ${scope} ${record}[data-pinned="true"] { box-shadow: 0 0 0 2px var(--badge-amber-indicator); }
      ${edge} { stroke: var(--chart-blue); stroke-width: 2.5; opacity: 1; }
      ${edge}[data-knowledge-pinned="true"] { stroke: var(--chart-amber); }
    `);
  }
  return rules.join('\n');
}
