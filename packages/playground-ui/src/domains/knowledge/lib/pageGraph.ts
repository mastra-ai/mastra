/**
 * Pure page-graph logic for the schema-4 explorer: parent links plus resolved
 * mentions between loaded pages → React Flow nodes and edges. Every scope is
 * one size and every page another, so a circle's size says what it is and its
 * name always fits inside.
 */

import type { Edge, Node } from '@xyflow/react';

import type { KnowledgePageEdge, KnowledgePagePayload, KnowledgeScopeGrantPayload } from '../pageTypes';
import type { KnowledgeGraphEdge } from '../types';
import { degreeMap } from './graphModel';
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

/** Id of the placeholder circle for a declared principal that has no scope page yet. */
export function unplacedScopeId(address: string): string {
  return `unplaced:${address}`;
}

/**
 * Grants as graph pages and edges. A grant from a principal with a loaded scope page draws from that
 * page; one whose principal has no scope page yet draws from a placeholder scope (one per address), so
 * a role nobody has written to still shows what it can reach. Grants to unloaded targets are dropped.
 */
export function grantGraph(
  pages: KnowledgePagePayload[],
  grants: readonly KnowledgeScopeGrantPayload[] = [],
): { placeholders: KnowledgePagePayload[]; edges: KnowledgePageEdge[] } {
  const live = new Set(pages.filter(page => !page.deletedAt && !page.mergedInto).map(page => page.id));
  const placeholders = new Map<string, KnowledgePagePayload>();
  const edges = new Map<string, KnowledgePageEdge>();
  for (const grant of grants) {
    if (!live.has(grant.target)) continue;
    let source = grant.principalId && live.has(grant.principalId) ? grant.principalId : null;
    if (!source) {
      if (grant.principalId) continue;
      source = unplacedScopeId(grant.principal);
      if (!placeholders.has(source)) placeholders.set(source, placeholderScope(source, grant));
    }
    if (source === grant.target) continue;
    edges.set(`${source}\u0000${grant.target}`, { source, target: grant.target, kind: 'grant', role: grant.role });
  }
  return { placeholders: [...placeholders.values()], edges: [...edges.values()] };
}

function placeholderScope(id: string, grant: KnowledgeScopeGrantPayload): KnowledgePagePayload {
  const nobody = { author: '' };
  return {
    id,
    scopeId: id,
    parentId: null,
    isScope: true,
    address: grant.principal,
    displayLabel: grant.principalLabel,
    position: '',
    name: grant.principal,
    version: 0,
    createdBy: nobody,
    updatedBy: nobody,
    createdAt: '',
    updatedAt: '',
  };
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
  degree: NodeDegree;
  selected: boolean;
}>;

export type PageFlowEdge = Edge<{ kind: KnowledgePageEdge['kind']; count: number; role?: KnowledgePageEdge['role'] }>;

/** Converts pages and their edges to React Flow elements; positions are left to the layout. */
export function toPageFlow(
  pages: KnowledgePagePayload[],
  edges: KnowledgePageEdge[],
  selectedId?: string | null,
): { nodes: PageFlowNode[]; edges: PageFlowEdge[] } {
  // Mention counts per page, for hosts that show them; parent edges add no signal.
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
  const nodes = pages
    .filter(page => !page.deletedAt && !page.mergedInto)
    .map((page): PageFlowNode => {
      const degree = degrees.get(page.id) ?? { incoming: 0, outgoing: 0 };
      return {
        id: page.id,
        type: 'page',
        position: { x: 0, y: 0 },
        data: {
          page,
          size: page.isScope ? KNOWLEDGE_SCOPE_SIZE : KNOWLEDGE_PAGE_SIZE,
          degree,
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
        data: { kind: edge.kind, count: edge.count ?? 1, ...(edge.role ? { role: edge.role } : {}) },
      }),
    ),
  };
}
