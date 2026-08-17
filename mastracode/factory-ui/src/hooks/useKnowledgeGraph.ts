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
import { fetchKnowledgeNode, fetchKnowledgeGraph } from '../ui/domains/factory/services/knowledge';
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

export function useKnowledgeGraph(
  factoryProjectId: string | undefined,
  threadId?: string,
  options?: { paused?: boolean },
) {
  const { baseUrl } = useApiConfig();
  const paused = options?.paused ?? false;
  return useQuery({
    queryKey: queryKeys.knowledgeGraph(factoryProjectId, threadId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, threadId, signal)
      : skipToken,
    // Live: same 5s cadence as the board (useWorkItems precedent).
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, paused),
    refetchOnWindowFocus: !paused,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeNode(
  factoryProjectId: string | undefined,
  nodeId: string | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeNode(factoryProjectId, nodeId, threadId),
    queryFn:
      factoryProjectId && nodeId
        ? ({ signal }) => fetchKnowledgeNode(baseUrl, factoryProjectId, nodeId, threadId, signal)
        : skipToken,
  });
}
