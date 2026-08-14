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

export function useKnowledgeGraph(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeGraph(factoryProjectId, threadId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, threadId, signal)
      : skipToken,
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
