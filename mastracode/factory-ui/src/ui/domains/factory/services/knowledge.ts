/**
 * Browser-side helpers for a Factory project's Knowledge (read-only).
 *
 * Talks to `/web/factory/projects/:id/knowledge/*` (`mastracode/factory/src/routes/knowledge.ts`), which
 * reads the page store as the project's org and project scopes: the member sees org and project pages,
 * never another project's or a session's.
 */
import type {
  KnowledgeExplorerActivity,
  KnowledgeExplorerGraph,
  KnowledgeExplorerPageDetail,
  KnowledgeExplorerTreeLevel,
  KnowledgeExplorerTreeRequest,
} from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import type { KnowledgePagePayload } from '@mastra/playground-ui/domains/knowledge/pageTypes';

import { isRecord } from '../../../../lib/isRecord';
import { readSSE } from '../../../lib/readSSE';
import { RequestError, requestJson } from './request';

export interface KnowledgeSearchPayload {
  results: Array<{ page: KnowledgePagePayload }>;
}

function knowledgeBase(baseUrl: string, factoryProjectId: string): string {
  return `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/knowledge`;
}

export function fetchKnowledgeGraph(
  baseUrl: string,
  factoryProjectId: string,
  signal?: AbortSignal,
): Promise<KnowledgeExplorerGraph> {
  return requestJson(`${knowledgeBase(baseUrl, factoryProjectId)}/graph`, { signal });
}

export function fetchKnowledgePage(
  baseUrl: string,
  factoryProjectId: string,
  pageId: string,
  noteCursor?: string,
  signal?: AbortSignal,
): Promise<KnowledgeExplorerPageDetail> {
  const query = noteCursor ? `?${new URLSearchParams({ noteCursor })}` : '';
  return requestJson(`${knowledgeBase(baseUrl, factoryProjectId)}/pages/${encodeURIComponent(pageId)}${query}`, {
    signal,
  });
}

/** One level of the page tree: the root scopes when `parentId` is null. */
export function fetchKnowledgeTreeLevel(
  baseUrl: string,
  factoryProjectId: string,
  request: KnowledgeExplorerTreeRequest,
  signal?: AbortSignal,
): Promise<KnowledgeExplorerTreeLevel> {
  const params = new URLSearchParams();
  if (request.parentId) params.set('parentId', request.parentId);
  if (request.cursor) params.set('cursor', request.cursor);
  const query = params.size ? `?${params}` : '';
  return requestJson(`${knowledgeBase(baseUrl, factoryProjectId)}/tree${query}`, { signal });
}

export function fetchKnowledgeActivity(
  baseUrl: string,
  factoryProjectId: string,
  pageId: string,
  signal?: AbortSignal,
): Promise<KnowledgeExplorerActivity> {
  return requestJson(`${knowledgeBase(baseUrl, factoryProjectId)}/activity?${new URLSearchParams({ pageId })}`, {
    signal,
  });
}

export function fetchKnowledgeSearch(
  baseUrl: string,
  factoryProjectId: string,
  query: string,
  signal?: AbortSignal,
): Promise<KnowledgeSearchPayload> {
  return requestJson(`${knowledgeBase(baseUrl, factoryProjectId)}/search?${new URLSearchParams({ q: query })}`, {
    signal,
  });
}

/** One committed write the member can read: re-read what it names through the other routes. */
export interface KnowledgeChangeNotice {
  kind: 'scope' | 'page' | 'note' | 'pin';
  op: string;
  pageId?: string;
  scopeId?: string;
  at: string;
}

/** Follows the project's Knowledge change stream until it ends, errors or `signal` aborts. */
export async function streamKnowledgeChanges(
  baseUrl: string,
  factoryProjectId: string,
  handlers: { onChange: (change: KnowledgeChangeNotice) => void; onConnected: () => void },
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${knowledgeBase(baseUrl, factoryProjectId)}/events`, {
    headers: { Accept: 'text/event-stream' },
    credentials: 'include',
    signal,
  });
  if (!response.ok || !response.body) {
    throw new RequestError(`Knowledge change stream failed (${response.status})`, response.status);
  }
  handlers.onConnected();
  await readSSE(response.body, (event, data) => {
    if (event !== 'change') return;
    const parsed: unknown = JSON.parse(data);
    if (isRecord(parsed)) handlers.onChange(parsed as unknown as KnowledgeChangeNotice);
  });
}
