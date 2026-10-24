/**
 * Browser-side helpers for the factory knowledge graph (read-only).
 *
 * Talks to the server's `/web/factory/projects/:id/knowledge/*` routes. The
 * payload shapes mirror `mastracode/factory/src/routes/knowledge.ts` — the
 * default view is project scope (org + project records); passing a `threadId`
 * requests the server-validated thread drill-down view.
 */
import { requestJson } from './request';
import type {
  KnowledgeActivityPayload,
  KnowledgeGraphPayload,
  KnowledgeNodePayload,
  KnowledgeScopeTreePayload,
  KnowledgeSearchPayload,
  KnowledgeSelection,
} from '@mastra/playground-ui/domains/knowledge/types';

export type * from '@mastra/playground-ui/domains/knowledge/types';

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
  cursor?: string,
  signal?: AbortSignal,
): Promise<KnowledgeActivityPayload> {
  const query = new URLSearchParams(knowledgeQuery(threadId, selection).slice(1));
  if (cursor) query.set('cursor', cursor);
  return requestJson<KnowledgeActivityPayload>(`${knowledgeBase(baseUrl, factoryProjectId)}/activity?${query}`, {
    signal,
  });
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
