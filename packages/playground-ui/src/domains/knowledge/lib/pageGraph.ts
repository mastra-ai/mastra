/**
 * Pure page-graph logic for the schema-4 explorer: parent links plus resolved
 * mentions between loaded pages → React Flow nodes and edges, sized by the
 * same incoming-weighted degree as the record graph.
 */

import type { Edge, Node } from '@xyflow/react';

import type { KnowledgePageEdge, KnowledgePagePayload } from '../pageTypes';
import type { KnowledgeGraphEdge } from '../types';
import { degreeMap, nodeSize, weightedDegree } from './graphModel';
import type { NodeDegree } from './graphModel';

/**
 * Edges among loaded, live pages: a parent edge for every loaded parent, and
 * the given mention edges merged per source → target (counts summed). Self
 * mentions and edges to unloaded pages are dropped.
 */
export function pageGraphEdges(
  pages: KnowledgePagePayload[],
  mentionEdges: KnowledgePageEdge[] = [],
): KnowledgePageEdge[] {
  const live = new Set(pages.filter(page => !page.deletedAt && !page.mergedInto).map(page => page.id));
  const edges: KnowledgePageEdge[] = [];
  for (const page of pages) {
    if (live.has(page.id) && page.parentId && page.parentId !== page.id && live.has(page.parentId)) {
      edges.push({ source: page.parentId, target: page.id, kind: 'parent' });
    }
  }
  const mentions = new Map<string, KnowledgePageEdge>();
  for (const edge of mentionEdges) {
    if (edge.kind !== 'mention' || edge.source === edge.target) continue;
    if (!live.has(edge.source) || !live.has(edge.target)) continue;
    const key = `${edge.source}\u0000${edge.target}`;
    const existing = mentions.get(key);
    const count = edge.count ?? 1;
    if (existing) existing.count = (existing.count ?? 1) + count;
    else mentions.set(key, { source: edge.source, target: edge.target, kind: 'mention', count });
  }
  return [...edges, ...mentions.values()];
}

export type PageFlowNode = Node<{
  page: KnowledgePagePayload;
  size: number;
  degree: NodeDegree;
  selected: boolean;
}>;

export type PageFlowEdge = Edge<{ kind: KnowledgePageEdge['kind']; count: number }>;

/** Converts pages and their edges to React Flow elements; positions are left to the layout. */
export function toPageFlow(
  pages: KnowledgePagePayload[],
  edges: KnowledgePageEdge[],
  selectedId?: string | null,
): { nodes: PageFlowNode[]; edges: PageFlowEdge[] } {
  // Only mentions count toward size: every non-root page has one parent, so parent edges add no signal.
  const degrees = degreeMap(
    edges
      .filter(edge => edge.kind === 'mention')
      .map(
        (edge, index): KnowledgeGraphEdge => ({
          id: String(index),
          source: edge.source,
          target: edge.target,
          type: 'wikilink',
        }),
      ),
  );
  let maxWeighted = 0;
  for (const degree of degrees.values()) maxWeighted = Math.max(maxWeighted, weightedDegree(degree));
  const nodes = pages
    .filter(page => !page.deletedAt && !page.mergedInto)
    .map((page): PageFlowNode => {
      const degree = degrees.get(page.id) ?? { incoming: 0, outgoing: 0 };
      return {
        id: page.id,
        type: 'page',
        position: { x: 0, y: 0 },
        data: { page, size: nodeSize(degree, maxWeighted), degree, selected: page.id === selectedId },
      };
    });
  return {
    nodes,
    edges: edges.map(
      (edge): PageFlowEdge => ({
        id: `${edge.kind}:${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        data: { kind: edge.kind, count: edge.count ?? 1 },
      }),
    ),
  };
}
