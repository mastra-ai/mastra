/**
 * Pure page-graph logic for the schema-4 explorer: parent links plus resolved
 * mentions between loaded pages → React Flow nodes and edges. Every scope is
 * one size and every page another, so a circle's size says what it is and its
 * name always fits inside.
 */

import type { Edge, Node } from '@xyflow/react';

import type { KnowledgePageEdge, KnowledgePagePayload } from '../pageTypes';

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

/** The page plus every page one edge away from it, either direction. */
export function pageNeighbourIds(pageId: string, edges: KnowledgePageEdge[]): Set<string> {
  const ids = new Set([pageId]);
  for (const edge of edges) {
    if (edge.source === pageId) ids.add(edge.target);
    if (edge.target === pageId) ids.add(edge.source);
  }
  return ids;
}

/** Circle diameters: big enough for a kind label and three lines of name. */
export const KNOWLEDGE_SCOPE_SIZE = 124;
export const KNOWLEDGE_PAGE_SIZE = 108;

export type PageFlowNode = Node<{
  page: KnowledgePagePayload;
  size: number;
  selected: boolean;
}>;

export type PageFlowEdge = Edge<{ kind: KnowledgePageEdge['kind']; count: number }>;

/** Converts pages and their edges to React Flow elements; positions are left to the layout. */
export function toPageFlow(
  pages: KnowledgePagePayload[],
  edges: KnowledgePageEdge[],
  selectedId?: string | null,
): { nodes: PageFlowNode[]; edges: PageFlowEdge[] } {
  const nodes = pages
    .filter(page => !page.deletedAt && !page.mergedInto)
    .map((page): PageFlowNode => {
      return {
        id: page.id,
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          page,
          size: page.isScope ? KNOWLEDGE_SCOPE_SIZE : KNOWLEDGE_PAGE_SIZE,
          selected: page.id === selectedId,
        },
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
