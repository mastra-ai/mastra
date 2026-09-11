/**
 * React Query hooks for the knowledge graph page.
 *
 * The graph query keys on `(factoryProjectId, threadId, knowledgeKey)` so the default
 * project view and each thread drill-down view are distinct cache entries —
 * switching views swaps payloads wholesale instead of mutating one entry.
 */

import { skipToken, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchKnowledgeActivity,
  fetchKnowledgeNode,
  fetchKnowledgeGraph,
  fetchKnowledgeScopes,
} from '../ui/domains/factory/services/knowledge';
import type { KnowledgeRung } from '../ui/domains/factory/services/knowledge';
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

export function useKnowledgeScopes(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  const [searchParams] = useSearchParams();
  const knowledgeKey = searchParams.get('knowledgeKey') ?? 'default';
  return useQuery({
    queryKey: [...queryKeys.knowledgeScopes(factoryProjectId, threadId), knowledgeKey],
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeScopes(baseUrl, factoryProjectId, threadId, signal, knowledgeKey)
      : skipToken,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeGraph(
  factoryProjectId: string | undefined,
  scopeLevel: KnowledgeRung | undefined,
  threadId?: string,
  options?: { paused?: boolean },
) {
  const { baseUrl } = useApiConfig();
  const [searchParams] = useSearchParams();
  const knowledgeKey = searchParams.get('knowledgeKey') ?? 'default';
  const paused = options?.paused ?? false;
  return useQuery({
    queryKey: [...queryKeys.knowledgeGraph(factoryProjectId, scopeLevel, threadId), knowledgeKey],
    queryFn:
      factoryProjectId && scopeLevel
        ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, scopeLevel, threadId, signal, knowledgeKey)
        : skipToken,
    // Live: same 5s cadence as the board (useWorkItems precedent).
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, paused),
    refetchOnWindowFocus: !paused,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeActivity(
  factoryProjectId: string | undefined,
  scopeLevel: KnowledgeRung | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  const [searchParams] = useSearchParams();
  const knowledgeKey = searchParams.get('knowledgeKey') ?? 'default';
  return useQuery({
    queryKey: [...queryKeys.knowledgeActivity(factoryProjectId, scopeLevel, threadId), knowledgeKey],
    queryFn:
      factoryProjectId && scopeLevel
        ? ({ signal }) => fetchKnowledgeActivity(baseUrl, factoryProjectId, scopeLevel, threadId, signal, knowledgeKey)
        : skipToken,
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
  const [searchParams] = useSearchParams();
  const knowledgeKey = searchParams.get('knowledgeKey') ?? 'default';
  return useQuery({
    queryKey: [...queryKeys.knowledgeNode(factoryProjectId, nodeId, scopeLevel, threadId), knowledgeKey],
    queryFn:
      factoryProjectId && nodeId && scopeLevel
        ? ({ signal }) =>
            fetchKnowledgeNode(baseUrl, factoryProjectId, nodeId, scopeLevel, threadId, signal, knowledgeKey)
        : skipToken,
  });
}
