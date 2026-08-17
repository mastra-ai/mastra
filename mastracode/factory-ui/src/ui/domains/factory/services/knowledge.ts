/**
 * Browser-side helpers for the factory knowledge graph (read-only).
 *
 * Talks to the server's `/web/factory/projects/:id/knowledge/*` routes. The
 * payload shapes mirror `mastracode/factory/src/routes/knowledge.ts` — the
 * default view is project scope (org + project records); passing a `threadId`
 * requests the server-validated thread drill-down view.
 */

import { requestJson } from './request';

export type KnowledgeRung = 'org' | 'resource' | 'thread';

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  scope: string[];
  rung: KnowledgeRung;
  /** A pinned item's wikilinks reference this node (the pin accent). */
  pinned: boolean;
  /** Knowledge items owned by this node inside the snapshot window (not a total). */
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  /** Always 'wikilink' — the item's owner node is the edge source. */
  type: 'wikilink';
  itemId: string;
  /** Derived from a PINNED item — the pin marks the relationship (A9). */
  pinned?: boolean;
}

/**
 * A knowledge item as a first-class graph element (A11): a windowed item with the
 * in-window nodes it touches, owner first (pins omit the hidden reserved
 * owner). Rendered by arity — 1: dot, 2: line, 3+: junction.
 */
export interface KnowledgeGraphItem {
  id: string;
  nodeIds: string[];
  pinned: boolean;
  /** Knowledge item text, truncated server-side for hover cards. */
  text: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  items: KnowledgeGraphItem[];
  truncated: boolean;
  outOfWindow: Array<{ id: string; name: string }>;
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeNodeItem {
  id: string;
  parentNodeId: string;
  relation: 'owned' | 'mentions';
  text: string;
  scope: string[];
  rung: KnowledgeRung;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
  /** This item IS a pin (authored under the reserved pinned node). */
  pinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeNodePayload {
  node: {
    id: string;
    name: string;
    kind: string;
    content: string;
    scope: string[];
    rung: KnowledgeRung;
    createdAt: string;
    updatedAt: string;
  };
  items: KnowledgeNodeItem[];
}

function knowledgeBase(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/knowledge`;
}

function threadQuery(threadId: string | undefined): string {
  return threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
}

export async function fetchKnowledgeGraph(
  baseUrl: string,
  factoryProjectId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeGraphPayload> {
  return requestJson<KnowledgeGraphPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/graph${threadQuery(threadId)}`,
    { signal },
  );
}

export async function fetchKnowledgeNode(
  baseUrl: string,
  factoryProjectId: string,
  nodeId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeNodePayload> {
  return requestJson<KnowledgeNodePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/nodes/${encodeURIComponent(nodeId)}${threadQuery(threadId)}`,
    { signal },
  );
}
