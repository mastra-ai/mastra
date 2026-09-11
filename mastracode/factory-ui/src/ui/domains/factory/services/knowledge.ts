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

/** A reconciled structural scope node from the server's scope tree. */
export interface KnowledgeScopeNode {
  id: string;
  name: string;
  kind?: string;
  description?: string;
  parentIds: string[];
}

export interface KnowledgeScopeTreePayload {
  roots: Array<{
    level: KnowledgeRung;
    id: string;
    available: boolean;
  }>;
  defaultLevel: 'resource';
  /** Reconciled structural scope tree (omitted when the adapter lacks it). */
  scopeNodes?: KnowledgeScopeNode[];
}

/**
 * What the explore view reads: an identity rung (org/resource/thread) or one
 * reconciled structural scope node by id.
 */
export type KnowledgeSelection =
  | { scopeLevel: KnowledgeRung; scopeNodeId?: never }
  | { scopeNodeId: string; scopeLevel?: never };

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  /** Null for structural scope-node members (global, not identity-scoped). */
  scope: string[] | null;
  rung: KnowledgeRung | null;
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

export interface KnowledgeActivityEvent {
  id: string;
  action: string;
  recordType: string;
  scope: string[];
  createdAt: string;
}

export interface KnowledgeActivityPayload {
  events: KnowledgeActivityEvent[];
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

// The Knowledge runtime is host-selected; requests carry no key override.
function knowledgeQuery(threadId: string | undefined, selection?: KnowledgeSelection): string {
  const query = new URLSearchParams();
  if (threadId) query.set('threadId', threadId);
  if (selection?.scopeLevel) query.set('scopeLevel', selection.scopeLevel);
  if (selection?.scopeNodeId) query.set('scopeNodeId', selection.scopeNodeId);
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function fetchKnowledgeScopes(
  baseUrl: string,
  factoryProjectId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeScopeTreePayload> {
  return requestJson<KnowledgeScopeTreePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/scopes${knowledgeQuery(threadId)}`,
    { signal },
  );
}

export async function fetchKnowledgeGraph(
  baseUrl: string,
  factoryProjectId: string,
  selection: KnowledgeSelection,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeGraphPayload> {
  return requestJson<KnowledgeGraphPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/subgraph${knowledgeQuery(threadId, selection)}`,
    { signal },
  );
}

export async function fetchKnowledgeActivity(
  baseUrl: string,
  factoryProjectId: string,
  scopeLevel: KnowledgeRung,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeActivityPayload> {
  return requestJson<KnowledgeActivityPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/activity${knowledgeQuery(threadId, { scopeLevel })}`,
    { signal },
  );
}

export async function fetchKnowledgeNode(
  baseUrl: string,
  factoryProjectId: string,
  nodeId: string,
  selection: KnowledgeSelection,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeNodePayload> {
  return requestJson<KnowledgeNodePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/nodes/${encodeURIComponent(nodeId)}${knowledgeQuery(threadId, selection)}`,
    { signal },
  );
}
