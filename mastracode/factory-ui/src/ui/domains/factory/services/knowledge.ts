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
  /** Canonical address the scope node was reconciled from (e.g. `org:acme`). */
  address: string;
  name: string;
  kind?: string;
  description?: string;
  parentIds: string[];
  /** Viewer-visible direct members, capped by the server's node window. */
  memberCount: number;
  /** True when more direct members may exist beyond `memberCount`. */
  memberCountTruncated: boolean;
  /** Viewer-visible content nodes directly assigned to this scope. */
  contentNodeCount: number;
  /** Direct child scopes available for lazy expansion. */
  childScopeCount: number;
}

export interface KnowledgeSearchResult {
  id: string;
  name: string;
  kind: string;
  type: 'scope' | 'node';
  rung: KnowledgeRung | null;
  threadId?: string;
  address?: string;
  description?: string;
}

export interface KnowledgeSearchPayload {
  results: KnowledgeSearchResult[];
  truncated: boolean;
}

export interface KnowledgeScopeTreePayload {
  roots: Array<{
    level: KnowledgeRung;
    id: string;
    available: boolean;
    /**
     * Set when a reconciled scope node owns this rung's address — the client
     * renders ONE entry (structural name, identity kind) that opens the
     * structural lens, instead of duplicating the scope under two labels.
     */
    scopeNodeId?: string;
    /** Structural name of the matched scope node (present iff scopeNodeId). */
    name?: string;
  }>;
  defaultLevel: 'resource';
  /** Reconciled structural scope tree (omitted when the adapter lacks it). */
  scopeNodes?: KnowledgeScopeNode[];
  /** Cursor for the next sibling page (roots when parentId is omitted). */
  nextCursor?: string;
  /** Initial child-page cursors keyed by parent scope id. */
  childCursors?: Record<string, string>;
}

/**
 * What the explore view reads: an identity rung (org/resource/thread), one
 * reconciled structural scope node by id, or a merged entry carrying both
 * (a scope node that owns a rung's address — structural lens plus the rung
 * for activity/flyout context).
 */
export type KnowledgeSelection =
  { scopeLevel: KnowledgeRung; scopeNodeId?: never } | { scopeNodeId: string; scopeLevel?: KnowledgeRung };

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
  /** Null for structural scope-node members (global, not identity-scoped). */
  scope: string[] | null;
  rung: KnowledgeRung | null;
  /** True for structural scope nodes (member-lens drill targets); absent for content nodes. */
  isScope?: boolean;
  /** Client-rendered authorized target beyond the bounded node window. */
  isBoundary?: boolean;
  /** A pinned record's wikilinks reference this node (the pin accent). */
  pinned: boolean;
  /** Knowledge records owned by this node inside the snapshot window (not a total). */
  recordCount: number;
  /** Viewer-visible direct members. Present only for structural scope nodes. */
  memberCount?: number;
  memberCountTruncated?: boolean;
  contentNodeCount?: number;
  childScopeCount?: number;
  /** Omitted for a structural lens root the adapter cannot read back as a node. */
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  /**
   * 'wikilink': derived from a record's wikilinks (the record's owner node is
   * the edge source). 'contains': structural lens only — the selected scope
   * node contains the target member, so the clicked scope renders as its own
   * graph root.
   */
  type: 'wikilink' | 'contains';
  /** The record whose text produced the edge; absent on containment edges. */
  recordId?: string;
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

export interface KnowledgeBoundaryNode {
  id: string;
  name: string;
  scope: string[];
  rung: KnowledgeRung;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  truncated: boolean;
  outOfWindow: KnowledgeBoundaryNode[];
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
  recordId?: string;
  scope: string[];
  node: {
    id: string;
    name: string;
    rung: KnowledgeRung;
    threadId?: string;
  };
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
    description?: string;
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
  page?: { parentId?: string; cursor?: string },
): Promise<KnowledgeScopeTreePayload> {
  const query = new URLSearchParams(knowledgeQuery(threadId).slice(1));
  if (page?.parentId) query.set('parentId', page.parentId);
  if (page?.cursor) query.set('cursor', page.cursor);
  const search = query.toString();
  return requestJson<KnowledgeScopeTreePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/scopes${search ? `?${search}` : ''}`,
    { signal },
  );
}

export async function fetchKnowledgeSearch(
  baseUrl: string,
  factoryProjectId: string,
  query: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeSearchPayload> {
  const search = new URLSearchParams(knowledgeQuery(threadId).slice(1));
  search.set('q', query);
  return requestJson<KnowledgeSearchPayload>(`${knowledgeBase(baseUrl, factoryProjectId)}/search?${search}`, {
    signal,
  });
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
  selection: KnowledgeSelection,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeActivityPayload> {
  return requestJson<KnowledgeActivityPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/activity${knowledgeQuery(threadId, selection)}`,
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
