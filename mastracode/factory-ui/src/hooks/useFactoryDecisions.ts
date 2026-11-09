import {
  infiniteQueryOptions,
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { useFeedPollInterval } from '../ui/domains/factory/context/FeedEventsProvider';
import { actOnFactoryDecision, fetchFactoryDecisions } from '../ui/domains/factory/services/decisions';
import type {
  FactoryDecisionAction,
  FactoryDecisionPage,
  FactoryDecisionStatus,
} from '../ui/domains/factory/services/decisions';

const STATUS_FALLBACK_POLL_MS = 2_000;
const HISTORY_FALLBACK_POLL_MS = 5_000;

export function factoryDecisionStatusQueryOptions(
  baseUrl: string,
  githubProjectId: string | undefined,
  statuses: FactoryDecisionStatus[],
) {
  return queryOptions({
    queryKey: queryKeys.factoryDecisions(githubProjectId, statuses.join(',')),
    queryFn: githubProjectId
      ? () => fetchFactoryDecisions(baseUrl, githubProjectId, { statuses, limit: 50 })
      : skipToken,
    staleTime: 1_000,
  });
}

export function useFactoryDecisionStatus(githubProjectId: string | undefined, statuses: FactoryDecisionStatus[]) {
  const { baseUrl } = useApiConfig();
  const refetchInterval = useFeedPollInterval(STATUS_FALLBACK_POLL_MS);
  return useQuery({ ...factoryDecisionStatusQueryOptions(baseUrl, githubProjectId, statuses), refetchInterval });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.factoryDecisionsRoot(githubProjectId) });
    },
  });
}

/** A page of decision history starts before this cursor; the first page has none. */
type DecisionCursor = string | undefined;
const FIRST_DECISION_PAGE: DecisionCursor = undefined;

export function factoryDecisionHistoryQueryOptions(
  baseUrl: string,
  githubProjectId: string | undefined,
  statusKey: string,
  statuses: FactoryDecisionStatus[] | undefined,
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.factoryDecisions(githubProjectId, statusKey),
    queryFn: githubProjectId
      ? ({ pageParam }: { pageParam: DecisionCursor }) =>
          fetchFactoryDecisions(baseUrl, githubProjectId, { statuses, before: pageParam, limit: 25 })
      : skipToken,
    initialPageParam: FIRST_DECISION_PAGE,
    getNextPageParam: (lastPage: FactoryDecisionPage) => lastPage.nextCursor,
    staleTime: 2_000,
  });
}

export function useFactoryDecisionHistory(
  githubProjectId: string | undefined,
  statusKey: string,
  statuses: FactoryDecisionStatus[] | undefined,
) {
  const { baseUrl } = useApiConfig();
  const refetchInterval = useFeedPollInterval(HISTORY_FALLBACK_POLL_MS);
  return useInfiniteQuery({
    ...factoryDecisionHistoryQueryOptions(baseUrl, githubProjectId, statusKey, statuses),
    refetchInterval,
  });
}
