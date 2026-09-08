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
  description?: string;
  scope: string[];
  rung: KnowledgeRung;
  /** A pinned record's wikilinks reference this node (the pin accent). */
  pinned: boolean;
  /** Knowledge records owned by this node inside the snapshot window (not a total). */
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  /** Always 'wikilink' — the record's owner node is the edge source. */
  type: 'wikilink';
  recordId: string;
  /** Derived from a PINNED record — the pin marks the relationship (A9). */
  pinned?: boolean;
}

/**
 * A knowledge record as a first-class graph element (A11): a windowed record with the
 * in-window nodes it touches, owner first (pins omit the hidden reserved
 * owner). Rendered by arity — 1: dot, 2: line, 3+: junction.
 */
export interface KnowledgeGraphRecord {
  id: string;
  nodeIds: string[];
  pinned: boolean;
  /** Knowledge record text, truncated server-side for hover cards. */
  text: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  truncated: boolean;
  outOfWindow: Array<{ id: string; name: string }>;
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeNodeRecord {
  id: string;
  node: string;
  relation: 'owned' | 'mentions';
  text: string;
  scope: string[];
  rung: KnowledgeRung;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
  /** This record IS a pin (authored under the reserved pinned node). */
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
  records: KnowledgeNodeRecord[];
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
