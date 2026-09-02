/**
 * React Query hooks for the knowledge graph page.
 *
 * The graph query keys on `(factoryProjectId, threadId)` so the default
 * project view and each thread drill-down view are distinct cache entries —
 * switching views swaps payloads wholesale instead of mutating one entry.
 */

import { skipToken, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  fetchKnowledgeActivity,
  fetchKnowledgeNode,
  fetchKnowledgeGraph,
  fetchKnowledgeProposal,
  fetchKnowledgeProposals,
  fetchKnowledgeScopes,
  reviewKnowledgeProposal,
  type KnowledgeActivityFilters,
  type KnowledgeProposalStatus,
} from '../ui/domains/factory/services/knowledge';
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

export function useKnowledgeScopes(
  factoryProjectId: string | undefined,
  scopeId: string | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeScopes(factoryProjectId, scopeId, threadId),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchKnowledgeScopes(baseUrl, factoryProjectId, scopeId, threadId, signal)
      : skipToken,
  });
}

export function useKnowledgeGraph(
  factoryProjectId: string | undefined,
  scopeId: string | undefined,
  threadId?: string,
  options?: { paused?: boolean },
) {
  const { baseUrl } = useApiConfig();
  const paused = options?.paused ?? false;
  return useQuery({
    queryKey: queryKeys.knowledgeSubgraph(factoryProjectId, scopeId, threadId),
    queryFn:
      factoryProjectId && scopeId
        ? ({ signal }) => fetchKnowledgeGraph(baseUrl, factoryProjectId, scopeId, threadId, signal)
        : skipToken,
    // Live: same 5s cadence as the board (useWorkItems precedent).
    refetchInterval: query => knowledgeRefetchInterval(query.state.error, paused),
    refetchOnWindowFocus: !paused,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useKnowledgeActivity(
  factoryProjectId: string | undefined,
  scopeId: string | undefined,
  threadId: string | undefined,
  filters: KnowledgeActivityFilters,
) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.knowledgeActivity(factoryProjectId, scopeId, threadId, JSON.stringify(filters)),
    queryFn: ({ pageParam, signal }) => {
      if (!factoryProjectId) throw new Error('A Factory project is required.');
      return fetchKnowledgeActivity(
        baseUrl,
        factoryProjectId,
        scopeId,
        threadId,
        filters,
        pageParam || undefined,
        signal,
      );
    },
    initialPageParam: '',
    getNextPageParam: page => page.nextCursor,
    enabled: Boolean(factoryProjectId),
    refetchInterval: 5_000,
  });
}

export function useKnowledgeProposals(
  factoryProjectId: string | undefined,
  status?: KnowledgeProposalStatus,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: [...queryKeys.knowledgeProposals(factoryProjectId, status), threadId ?? null],
    queryFn: ({ pageParam, signal }) => {
      if (!factoryProjectId) throw new Error('A Factory project is required.');
      return fetchKnowledgeProposals(baseUrl, factoryProjectId, status, pageParam || undefined, threadId, signal);
    },
    initialPageParam: '',
    getNextPageParam: page => page.nextCursor,
    enabled: Boolean(factoryProjectId),
    refetchInterval: 5_000,
  });
}

export function useKnowledgeProposal(
  factoryProjectId: string | undefined,
  proposalId: string | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: [...queryKeys.knowledgeProposals(factoryProjectId), threadId ?? null, proposalId ?? null],
    queryFn:
      factoryProjectId && proposalId
        ? ({ signal }) => fetchKnowledgeProposal(baseUrl, factoryProjectId, proposalId, threadId, signal)
        : skipToken,
    retry: (failureCount, error) => !(error instanceof RequestError && error.status === 404) && failureCount < 2,
  });
}

export function useReviewKnowledgeProposal(factoryProjectId: string | undefined, threadId?: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'reject' | 're-review'; reason?: string }) => {
      if (!factoryProjectId) throw new Error('A Factory project is required.');
      return reviewKnowledgeProposal(baseUrl, factoryProjectId, input.id, input.action, input.reason, threadId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['factory', 'knowledge-proposals', factoryProjectId ?? null] });
      await queryClient.invalidateQueries({ queryKey: ['factory', 'knowledge-subgraph', factoryProjectId ?? null] });
      await queryClient.invalidateQueries({ queryKey: ['factory', 'knowledge-activity', factoryProjectId ?? null] });
    },
  });
}

export function useKnowledgeNode(
  factoryProjectId: string | undefined,
  nodeId: string | undefined,
  scopeId: string | undefined,
  threadId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.knowledgeNode(factoryProjectId, nodeId, scopeId, threadId),
    queryFn:
      factoryProjectId && nodeId && scopeId
        ? ({ signal }) => fetchKnowledgeNode(baseUrl, factoryProjectId, nodeId, scopeId, threadId, signal)
        : skipToken,
  });
}
