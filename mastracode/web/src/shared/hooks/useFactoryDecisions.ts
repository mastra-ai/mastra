import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchFactoryDecisions, retryFactoryDecision } from '../../web/ui/domains/factory/services/decisions';
import type { FactoryDecisionPage, FactoryDecisionStatus } from '../../web/ui/domains/factory/services/decisions';

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

export function useRetryFactoryDecision(githubProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisionId: string) => retryFactoryDecision(baseUrl, githubProjectId!, decisionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['factory', 'decisions', githubProjectId ?? null] });
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
