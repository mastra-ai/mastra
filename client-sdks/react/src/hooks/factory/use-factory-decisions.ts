import type {
  Factory,
  FactoryDecisionAction,
  FactoryDecisionPage,
  FactoryDecisionStatus,
  RunQueueResponse,
} from '@mastra/client-js';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import {
  infiniteQueryOptions,
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useFactory } from './context';
import { factoryKeys } from './keys';
import type { FactoryInfiniteQueryOptions, FactoryQueryOptions } from './query-options';

export function factoryDecisionStatusQueryOptions(
  factory: Factory | undefined,
  statuses: FactoryDecisionStatus[],
): FactoryQueryOptions<FactoryDecisionPage, ReturnType<typeof factoryKeys.decisions>> {
  return queryOptions({
    queryKey: factoryKeys.decisions(factory?.factoryProjectId, statuses.join(',')),
    queryFn: factory ? ({ signal }) => factory.decisions({ statuses, limit: 50 }, { signal }) : skipToken,
    staleTime: 1_000,
  });
}

export function useFactoryDecisionStatus(factoryProjectId: string | undefined, statuses: FactoryDecisionStatus[]) {
  return useQuery(factoryDecisionStatusQueryOptions(useFactory(factoryProjectId), statuses));
}

/** Automated runs waiting for a run slot; the feed refreshes it with the board's decisions. */
export function runQueueQueryOptions(
  factory: Factory | undefined,
): FactoryQueryOptions<RunQueueResponse, ReturnType<typeof factoryKeys.runQueue>> {
  return queryOptions({
    queryKey: factoryKeys.runQueue(factory?.factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.runQueue({ signal }) : skipToken,
    staleTime: 1_000,
  });
}

export function useRunQueue(factoryProjectId: string | undefined) {
  return useQuery(runQueueQueryOptions(useFactory(factoryProjectId)));
}

/** Release, turn down, or requeue one queued effect. */
export function useFactoryDecisionAction(factoryProjectId: string | undefined, action: FactoryDecisionAction) {
  const factory = useFactory(factoryProjectId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisionId: string) => {
      if (!factory) throw new Error('Factory project is required');
      return factory.actOnDecision(decisionId, action);
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: factoryKeys.sessionRowsRoot(factoryProjectId) });
      await queryClient.invalidateQueries({ queryKey: factoryKeys.decisionsRoot(factoryProjectId) });
    },
  });
}

/** A page of decision history starts before this cursor; the first page has none. */
type DecisionCursor = string | undefined;
const FIRST_DECISION_PAGE: DecisionCursor = undefined;

export function factoryDecisionHistoryQueryOptions(
  factory: Factory | undefined,
  statusKey: string,
  statuses: FactoryDecisionStatus[] | undefined,
): FactoryInfiniteQueryOptions<FactoryDecisionPage, ReturnType<typeof factoryKeys.decisions>, DecisionCursor> {
  return infiniteQueryOptions({
    queryKey: factoryKeys.decisions(factory?.factoryProjectId, statusKey),
    queryFn: factory
      ? ({ pageParam, signal }: { pageParam: DecisionCursor; signal: AbortSignal }) =>
          factory.decisions({ statuses, before: pageParam, limit: 25 }, { signal })
      : skipToken,
    initialPageParam: FIRST_DECISION_PAGE,
    getNextPageParam: (lastPage: FactoryDecisionPage) => lastPage.nextCursor,
    staleTime: 2_000,
  });
}

export function useFactoryDecisionHistory(
  factoryProjectId: string | undefined,
  statusKey: string,
  statuses: FactoryDecisionStatus[] | undefined,
): UseInfiniteQueryResult<InfiniteData<FactoryDecisionPage, DecisionCursor>> {
  return useInfiniteQuery(factoryDecisionHistoryQueryOptions(useFactory(factoryProjectId), statusKey, statuses));
}
