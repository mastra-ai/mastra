/**
 * Browser-side helpers for the factory knowledge graph (read-only).
 *
 * Talks to the server's `/web/factory/projects/:id/knowledge/*` routes. The
 * payload shapes mirror `mastracode/factory/src/routes/knowledge.ts` — the
 * default view is project scope (org + project records); passing a `threadId`
 * requests the server-validated thread drill-down view.
 */

import { requestJson } from './request';

export interface KnowledgeGraphNode {
  id: string;
  reference: string;
  name: string;
  kind: string;
  description?: string;
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

export interface KnowledgeScopeTreeNode {
  id: string;
  name: string;
  kind: string;
  description?: string;
}

export interface KnowledgeScopeTreePayload {
  scope: KnowledgeScopeTreeNode;
  children: KnowledgeScopeTreeNode[];
  nextCursor?: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  scopeId: string;
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
  nodeId: string;
  relation: 'owned' | 'mentions';
  text: string;
  createdAt: string;
  when?: string;
  reason?: string;
  /** This record IS a pin (authored under the reserved pinned node). */
  pinned: boolean;
}

export interface KnowledgeActivityEvent {
  id: string;
  action: string;
  targetType: string;
  scopeId?: string;
  sourceType: 'importer' | 'system';
  sourceId?: string;
  importRunId?: string;
  createdAt: string;
}

export interface KnowledgeActivityPayload {
  events: KnowledgeActivityEvent[];
  nextCursor?: string;
}

export interface KnowledgeActivityFilters {
  action?: string;
  sourceType?: 'importer' | 'system';
  from?: string;
  to?: string;
}

export type KnowledgeProposalStatus = 'pending' | 'approved' | 'rejected' | 'conflicted';

export interface KnowledgeProposal {
  id: string;
  reference: string;
  operation: string;
  status: KnowledgeProposalStatus;
  reason?: string;
  reviewReason?: string;
  targets: Array<{
    type: 'node' | 'record';
    id: string;
    name?: string;
    expectedVersion: number;
    currentVersion?: number;
  }>;
  proposer: 'visible' | 'private';
  reviewer?: 'visible' | 'private';
  actions: Array<'approve' | 'reject' | 're-review'>;
  createdAt: string;
  reviewedAt?: string;
}

export interface KnowledgeProposalsPayload {
  proposals: KnowledgeProposal[];
  nextCursor?: string;
}

export interface KnowledgeNodePayload {
  node: {
    id: string;
    name: string;
    kind: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecord[];
}

function knowledgeBase(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/knowledge`;
}

function knowledgeQuery(input: {
  threadId?: string;
  scopeId?: string;
  cursor?: string;
  action?: string;
  sourceType?: 'importer' | 'system';
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();
  if (input.threadId) params.set('threadId', input.threadId);
  if (input.scopeId) params.set('scopeId', input.scopeId);
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.action) params.set('action', input.action);
  if (input.sourceType) params.set('sourceType', input.sourceType);
  if (input.from) params.set('from', input.from);
  if (input.to) params.set('to', input.to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchKnowledgeScopes(
  baseUrl: string,
  factoryProjectId: string,
  scopeId?: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeScopeTreePayload> {
  return requestJson<KnowledgeScopeTreePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/scopes${knowledgeQuery({ threadId, scopeId })}`,
    { signal },
  );
}

export async function fetchKnowledgeGraph(
  baseUrl: string,
  factoryProjectId: string,
  scopeId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeGraphPayload> {
  return requestJson<KnowledgeGraphPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/subgraph${knowledgeQuery({ threadId, scopeId })}`,
    { signal },
  );
}

export async function fetchKnowledgeActivity(
  baseUrl: string,
  factoryProjectId: string,
  scopeId?: string,
  threadId?: string,
  filters: KnowledgeActivityFilters = {},
  cursor?: string,
  signal?: AbortSignal,
): Promise<KnowledgeActivityPayload> {
  return requestJson<KnowledgeActivityPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/activity${knowledgeQuery({ threadId, scopeId, ...filters, cursor })}`,
    { signal },
  );
}

export async function fetchKnowledgeProposals(
  baseUrl: string,
  factoryProjectId: string,
  status: KnowledgeProposalStatus | undefined,
  cursor: string | undefined,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeProposalsPayload> {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (cursor) query.set('cursor', cursor);
  if (threadId) query.set('threadId', threadId);
  const suffix = query.size ? `?${query.toString()}` : '';
  return requestJson<KnowledgeProposalsPayload>(`${knowledgeBase(baseUrl, factoryProjectId)}/proposals${suffix}`, {
    signal,
  });
}

export async function fetchKnowledgeProposal(
  baseUrl: string,
  factoryProjectId: string,
  proposalId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeProposal> {
  return requestJson<KnowledgeProposal>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/proposals/${encodeURIComponent(proposalId)}${knowledgeQuery({ threadId })}`,
    { signal },
  );
}

export async function reviewKnowledgeProposal(
  baseUrl: string,
  factoryProjectId: string,
  proposalId: string,
  action: 'approve' | 'reject' | 're-review',
  reason?: string,
  threadId?: string,
): Promise<KnowledgeProposal> {
  return requestJson<KnowledgeProposal>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/proposals/${encodeURIComponent(proposalId)}/${action}${knowledgeQuery({ threadId })}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    },
  );
}

export async function fetchKnowledgeNode(
  baseUrl: string,
  factoryProjectId: string,
  nodeId: string,
  scopeId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeNodePayload> {
  return requestJson<KnowledgeNodePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/nodes/${encodeURIComponent(nodeId)}${knowledgeQuery({ threadId, scopeId })}`,
    { signal },
  );
}
