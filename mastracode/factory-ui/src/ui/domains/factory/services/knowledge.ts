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
  /** A pinned fact's wikilinks reference this entity (the pin accent). */
  pinned: boolean;
  /** Facts owned by this entity inside the snapshot window (not a total). */
  factCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  /** Always 'wikilink' — the fact's owner entity is the edge source. */
  type: 'wikilink';
  factId: string;
}

export interface KnowledgeGraphPayload {
  view: 'project' | 'thread';
  threadId?: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  truncated: boolean;
  outOfWindow: Array<{ id: string; name: string }>;
  unresolvedCapped: { count: number; names: string[] };
  pinCensus: { resource: number; thread: number | null };
  version: string | null;
}

export interface KnowledgeEntityFact {
  id: string;
  parentEntityId: string;
  relation: 'owned' | 'mentions';
  text: string;
  scope: string[];
  rung: KnowledgeRung;
  sourceThreadId: string;
  capturedAt: string;
  when?: string;
  /** This fact IS a pin (authored under the reserved pinned entity). */
  pinned: boolean;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeEntityPayload {
  entity: {
    id: string;
    name: string;
    kind: string;
    scope: string[];
    rung: KnowledgeRung;
    createdAt: string;
    updatedAt: string;
  };
  facts: KnowledgeEntityFact[];
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

export async function fetchKnowledgeEntity(
  baseUrl: string,
  factoryProjectId: string,
  entityId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<KnowledgeEntityPayload> {
  return requestJson<KnowledgeEntityPayload>(
    `${knowledgeBase(baseUrl, factoryProjectId)}/entities/${encodeURIComponent(entityId)}${threadQuery(threadId)}`,
    { signal },
  );
}
