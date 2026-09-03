/**
 * Browser-side helpers for the factory knowledge graph (read-only).
 *
 * Talks to the server's `/web/factory/projects/:id/knowledge/*` routes. The
 * payload shapes mirror `mastracode/factory/src/routes/knowledge.ts` — the
 * default view is project scope (org + project records); passing a `threadId`
 * requests the server-validated thread drill-down view.
 */

import { requestJson } from './request';

/** Scope rung a node belongs to — org-wide, project (resource), or session (thread). */
export type KnowledgeRung = 'org' | 'resource' | 'thread';

export type KnowledgeSelection =
  | { scopeLevel: KnowledgeRung; scopeNodeId?: never }
  | { scopeNodeId: string; scopeLevel?: KnowledgeRung };

export interface KnowledgeScopeNode {
  id: string;
  address: string;
  name: string;
  kind?: string;
  description?: string;
  parentIds: string[];
  memberCount: number;
  memberCountTruncated: boolean;
  contentNodeCount: number;
  childScopeCount: number;
}

export interface KnowledgeGraphNode {
  id: string;
  reference?: string;
  name: string;
  kind: string;
  description?: string;
  /** Scope rung the node sits on (drives the ring color + rung filters). */
  rung?: KnowledgeRung | null;
  isScope?: boolean;
  isBoundary?: boolean;
  /** A pinned record's wikilinks reference this node (the pin accent). */
  pinned: boolean;
  /** Knowledge records owned by this node inside the current lens page (not a total). */
  recordCount: number;
  /** Viewer-visible direct members. Present only for structural scope nodes. */
  memberCount?: number;
  memberCountTruncated?: boolean;
  contentNodeCount?: number;
  childScopeCount?: number;
  /** Present only for an authorized node one mention hop outside the selected scope. */
  boundary?: { scope: KnowledgeScopeTreeNode };
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'wikilink' | 'contains';
  recordId?: string;
  /** True only for an authorized one-hop edge leaving the selected scope. */
  boundary?: boolean;
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
  memberCount?: number;
  memberCountTruncated?: boolean;
  contentNodeCount?: number;
  childScopeCount?: number;
  needsCuration?: boolean;
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
  scope: KnowledgeScopeTreeNode;
  children: KnowledgeScopeTreeNode[];
  curationDestination?: KnowledgeScopeTreeNode;
  nextCursor?: string;
}

export interface KnowledgeBoundaryNode {
  id: string;
  reference?: string;
  name: string;
  scope?: string[];
  rung?: KnowledgeRung;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  scope: KnowledgeScopeTreeNode;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  records: KnowledgeGraphRecord[];
  truncated?: boolean;
  outOfWindow?: KnowledgeBoundaryNode[];
  unresolvedCapped?: { count: number; names: string[] };
  pinCensus?: { resource: number; thread: number | null };
  page: {
    nextCursor?: string;
    truncated: boolean;
    terminalBounds: Array<'record-window' | 'edge-window' | 'wikilink-resolution-window'>;
  };
  limits: {
    maxNodes: number;
    maxEdges: number;
    maxBoundaryNodes: number;
    boundaryHops: 1;
  };
  version?: string | null;
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
    rung: KnowledgeRung;
    createdAt: string;
    updatedAt: string;
  };
  records: KnowledgeNodeRecord[];
}

export interface KnowledgeCurationWorkItem {
  id: string;
  reference: string;
  name: string;
  kind: string;
  version: number;
  actions: { merge: boolean; discard: boolean };
  description?: string;
  evidence: Array<{ source?: string; provenance?: string }>;
  evidenceCursor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeCurationWorklistPayload {
  scopeId: string;
  items: KnowledgeCurationWorkItem[];
  nextCursor?: string;
}

export interface KnowledgeCurationEvidencePayload {
  evidence: Array<{ source?: string; provenance?: string }>;
  nextCursor?: string;
}

export interface KnowledgeCurationMergeTargetsPayload {
  targets: Array<{ id: string; reference: string; name: string; kind: string; version: number }>;
}

export interface KnowledgeCurationActionPayload {
  outcome: 'applied' | 'proposed' | 'retained';
  node?: { id: string; reference: string; name: string; kind: string; version: number };
  proposal?: { id: string; reference: string; status: KnowledgeProposalStatus };
}

export type KnowledgeCurationActionInput =
  | { action: 'retain'; scopeId: string; nodeId: string }
  | { action: 'discard'; scopeId: string; nodeId: string; version: number }
  | {
      action: 'refine';
      scopeId: string;
      nodeId: string;
      version: number;
      name?: string;
      kind?: string;
      description?: string;
      reason?: string;
    }
  | {
      action: 'promote';
      scopeId: string;
      nodeId: string;
      version: number;
      destinationScopeId: string;
      reason?: string;
    }
  | {
      action: 'merge';
      scopeId: string;
      nodeId: string;
      version: number;
      targetId: string;
      targetVersion: number;
    };

function knowledgeBase(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/knowledge`;
}

function knowledgeQuery(input: {
  threadId?: string;
  scopeId?: string;
  cursor?: string;
  limit?: number;
  query?: string;
  action?: string;
  sourceType?: 'importer' | 'system';
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();
  if (input.threadId) params.set('threadId', input.threadId);
  if (input.scopeId) params.set('scopeId', input.scopeId);
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.limit !== undefined) params.set('limit', String(input.limit));
  if (input.query) params.set('query', input.query);
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

export async function fetchKnowledgeSearch(
  baseUrl: string,
  factoryProjectId: string,
  query: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeSearchPayload> {
  const params = new URLSearchParams();
  params.set('q', query);
  if (threadId) params.set('threadId', threadId);
  return requestJson<KnowledgeSearchPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/search?${params.toString()}`,
    { signal },
  );
}

export async function fetchKnowledgeGraph(
  baseUrl: string,
  factoryProjectId: string,
  scopeId: string,
  cursor?: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeGraphPayload> {
  return requestJson<KnowledgeGraphPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/subgraph${knowledgeQuery({ threadId, scopeId, cursor })}`,
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

export async function fetchKnowledgeCurationWorklist(
  baseUrl: string,
  factoryProjectId: string,
  scopeId: string,
  cursor?: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeCurationWorklistPayload> {
  return requestJson<KnowledgeCurationWorklistPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/curation/worklist${knowledgeQuery({ scopeId, cursor, threadId })}`,
    { signal },
  );
}

export async function fetchKnowledgeCurationEvidence(
  baseUrl: string,
  factoryProjectId: string,
  scopeId: string,
  nodeId: string,
  cursor?: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeCurationEvidencePayload> {
  return requestJson<KnowledgeCurationEvidencePayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/curation/items/${encodeURIComponent(nodeId)}/evidence${knowledgeQuery({ scopeId, cursor, threadId })}`,
    { signal },
  );
}

export async function fetchKnowledgeCurationMergeTargets(
  baseUrl: string,
  factoryProjectId: string,
  scopeId: string,
  query: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeCurationMergeTargetsPayload> {
  return requestJson<KnowledgeCurationMergeTargetsPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/curation/merge-targets${knowledgeQuery({ scopeId, query, threadId })}`,
    { signal },
  );
}

export async function runKnowledgeCurationAction(
  baseUrl: string,
  factoryProjectId: string,
  input: KnowledgeCurationActionInput,
  threadId?: string,
): Promise<KnowledgeCurationActionPayload> {
  const { action, ...body } = input;
  return requestJson<KnowledgeCurationActionPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/curation/actions/${action}${knowledgeQuery({ threadId })}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
