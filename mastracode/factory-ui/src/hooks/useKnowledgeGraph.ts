/**
 * React Query hooks for the knowledge graph page.
 *
 * The graph query keys on `(factoryProjectId, selection, threadId)` so the default
 * project view, each thread drill-down view, and each structural scope-node lens
 * are distinct cache entries — switching views swaps payloads wholesale instead of
 * mutating one entry.
 */

import { skipToken, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchKnowledgeActivity,
  fetchKnowledgeNode,
  fetchKnowledgeGraph,
  fetchKnowledgeScopes,
  fetchKnowledgeSearch,
} from '../ui/domains/factory/services/knowledge';
import type { KnowledgeRung, KnowledgeSelection } from '../ui/domains/factory/services/knowledge';
import { RequestError } from '../ui/domains/factory/services/request';

/**
 * Live polling gate. Only a 404 is terminal (stale/deleted session on a
 * thread view); transient errors keep polling so a hiccup never freezes
 * live updates. `paused` (the user is interacting with the graph) suspends
 * polling so the layout never shifts under someone mid-exploration.
 */
export function knowledgeRefetchInterval(error: unknown, paused: boolean): number | false {
  if (error instanceof RequestError && error.status === 404) return false;
  if (paused) return false;
  return 5_000;
}

/** Cache-key slot for a selection: the scope node id or the identity rung. */
function selectionKey(selection: KnowledgeSelection | undefined): string | undefined {
  return selection?.scopeNodeId ?? selection?.scopeLevel;
}

export function useKnowledgeScopes(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeScopes(factoryProjectId, threadId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeScopes(baseUrl, factoryProjectId, threadId, signal)
      : skipToken,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeSearch(factoryProjectId: string | undefined, query: string, threadId?: string) {
  const { baseUrl } = useApiConfig();
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: queryKeys.knowledgeSearch(factoryProjectId, normalizedQuery, threadId),
    queryFn:
      factoryProjectId && normalizedQuery.length >= 2
        ? ({ signal }) => fetchKnowledgeSearch(baseUrl, factoryProjectId, normalizedQuery, threadId, signal)
        : skipToken,
  });
}

export function useKnowledgeScopePage(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  return useMutation({
    mutationFn: (page: { parentId?: string; cursor?: string }) => {
      if (!factoryProjectId) throw new Error('Factory project is required.');
      return fetchKnowledgeScopes(baseUrl, factoryProjectId, threadId, undefined, page);
    },
  });
}

export function useKnowledgeGraph(
  factoryProjectId: string | undefined,
  selection: KnowledgeSelection | undefined,
  threadId?: string,
  options?: { paused?: boolean },
) {
  const { baseUrl } = useApiConfig();
  const paused = options?.paused ?? false;
  return useQuery({
    queryKey: queryKeys.knowledgeGraph(factoryProjectId, selectionKey(selection), threadId),
    queryFn:
      factoryProjectId && selection
        ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, selection, threadId, signal)
        : skipToken,
    // Live: same 5s cadence as the board (useWorkItems precedent).
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, paused),
    refetchOnWindowFocus: !paused,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeActivity(
  factoryProjectId: string | undefined,
  selection: KnowledgeSelection | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  const initialPageParam: string | undefined = undefined;
  const queryFn =
    factoryProjectId && selection
      ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
          fetchKnowledgeActivity(baseUrl, factoryProjectId, selection, threadId, pageParam, signal)
      : skipToken;
  return useInfiniteQuery({
    queryKey: queryKeys.knowledgeActivity(factoryProjectId, selectionKey(selection), threadId),
    queryFn,
    initialPageParam,
    getNextPageParam: lastPage => lastPage.nextCursor,
    maxPages: 5,
    refetchInterval: 5_000,
  });
}

export function useKnowledgeNode(
  factoryProjectId: string | undefined,
  nodeId: string | undefined,
  scopeLevel: KnowledgeRung | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeNode(factoryProjectId, nodeId, scopeLevel, threadId),
    queryFn:
      factoryProjectId && nodeId && scopeLevel
        ? ({ signal }) => fetchKnowledgeNode(baseUrl, factoryProjectId, nodeId, { scopeLevel }, threadId, signal)
        : skipToken,
  });
}
