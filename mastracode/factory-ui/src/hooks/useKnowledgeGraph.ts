/**
 * React Query hooks for the knowledge graph page.
 *
 * The graph query keys on `(factoryProjectId, threadId)` so the default
 * project view and each thread drill-down view are distinct cache entries —
 * switching views swaps payloads wholesale instead of mutating one entry.
 */

import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchKnowledgeEntity, fetchKnowledgeGraph } from '../ui/domains/factory/services/knowledge';
import { RequestError } from '../ui/domains/factory/services/request';

export function useKnowledgeGraph(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeGraph(factoryProjectId, threadId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, threadId, signal)
      : skipToken,
    // Live: same 5s cadence as the board (useWorkItems precedent). Only a 404
    // is terminal (stale/deleted session on a thread view) — transient errors
    // keep polling so a single hiccup never freezes live updates.
    refetchInterval: query =>
      query.state.error instanceof RequestError && query.state.error.status === 404 ? false : 5_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeEntity(
  factoryProjectId: string | undefined,
  entityId: string | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeEntity(factoryProjectId, entityId, threadId),
    queryFn:
      factoryProjectId && entityId
        ? ({ signal }) => fetchKnowledgeEntity(baseUrl, factoryProjectId, entityId, threadId, signal)
        : skipToken,
  });
}
