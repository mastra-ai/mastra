import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { actOnFactoryDecision, fetchFactoryDecisions } from '../ui/domains/factory/services/decisions';
import type {
  FactoryDecisionAction,
  FactoryDecisionPage,
  FactoryDecisionStatus,
} from '../ui/domains/factory/services/decisions';

export function useFactoryDecisionStatus(githubProjectId: string | undefined, statuses: FactoryDecisionStatus[]) {
  const { baseUrl } = useApiConfig();
  const statusKey = statuses.join(',');
  return useQuery({
    queryKey: queryKeys.factoryDecisions(githubProjectId, statusKey),
    queryFn: () => fetchFactoryDecisions(baseUrl, githubProjectId!, { statuses, limit: 50 }),
    enabled: Boolean(githubProjectId),
    refetchInterval: 2_000,
    staleTime: 1_000,
  });
}

/** Release, turn down, or requeue one queued effect. */
export function useFactoryDecisionAction(githubProjectId: string | undefined, action: FactoryDecisionAction) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisionId: string) => {
      if (!githubProjectId) throw new Error('Factory project is required');
      return actOnFactoryDecision(baseUrl, githubProjectId, decisionId, action);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(githubProjectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(githubProjectId) }),
      ]);
    },
  });
}

/**
 * Clearing a queue nobody wants, one request at a time — there is no bulk route,
 * and each dismissal is its own audited consent. Sequential so a fifty-deep
 * queue does not arrive at the dispatcher as fifty concurrent writes.
 */
export function useDismissFactoryDecisions(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (decisionIds: string[]) => {
      if (!githubProjectId) throw new Error('Factory project is required');
      for (const decisionId of decisionIds) {
        await actOnFactoryDecision(baseUrl, githubProjectId, decisionId, 'dismiss');
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(githubProjectId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.factoryAttentionRoot(githubProjectId) }),
      ]);
    },
  });
}

export function useFactoryDecisionHistory(
  githubProjectId: string | undefined,
  statusKey: string,
  statuses: FactoryDecisionStatus[] | undefined,
) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.factoryDecisions(githubProjectId, statusKey),
    queryFn: ({ pageParam }) =>
      fetchFactoryDecisions(baseUrl, githubProjectId!, { statuses, before: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: FactoryDecisionPage) => lastPage.nextCursor,
    enabled: Boolean(githubProjectId),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
}
