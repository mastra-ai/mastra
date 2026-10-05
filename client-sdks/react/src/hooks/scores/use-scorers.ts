import type { MastraClient,GetScorerResponse,ListScoresResponse } from '@mastra/client-js';
import type { UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { isObservabilityUnavailableError, isUnsupportedObservabilityOperationError } from '../query-utils';
import { useInView } from '../shared/use-in-view';

const SCORES_PER_PAGE = 25;
const SCORES_REFETCH_INTERVAL_MS = 15_000;

export function getScoresRefetchInterval(query: { state: { error: unknown } }) {
  if (
    isUnsupportedObservabilityOperationError(query.state.error, 'scores') ||
    isObservabilityUnavailableError(query.state.error)
  ) {
    return false;
  }
  return SCORES_REFETCH_INTERVAL_MS;
}

type UseScoresByScorerIdProps<TData> = {
  scorerId: string;
  entityId?: string;
  entityType?: string;
  /** TanStack overrides spread last; `select` defaults to the flattened, de-duplicated score list. */
  queryOptions?: MastraInfiniteQueryOptions<ListScoresResponse, TData, readonly unknown[], number>;
};

function getScoresNextPageParam(lastPage: ListScoresResponse | undefined, _allPages: unknown, lastPageParam: number) {
  if (lastPage?.pagination?.hasMore) {
    return lastPageParam + 1;
  }
  return undefined;
}

function selectFlatScores(data: { pages: ListScoresResponse[] }) {
  const seen = new Set<string>();
  const scores = data.pages
    .flatMap(page => page.scores ?? [])
    .filter(score => {
      if (seen.has(score.id)) return false;
      seen.add(score.id);
      return true;
    });
  return scores;
}

export const useScoresByScorerId = <TData = ReturnType<typeof selectFlatScores>>({
  scorerId,
  entityId,
  entityType,
  queryOptions,
}: UseScoresByScorerIdProps<TData>): UseInfiniteQueryResult<TData, Error> & {
  setEndOfListElement: ReturnType<typeof useInView>['setRef'];
} => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery<ListScoresResponse, Error, TData, readonly unknown[], number>({
    queryKey: ['scores', scorerId, entityId, entityType],
    queryFn: ({ pageParam }) =>
      client.listScoresByScorerId({ scorerId, page: pageParam, perPage: SCORES_PER_PAGE, entityId, entityType }),
    initialPageParam: 0,
    getNextPageParam: getScoresNextPageParam,
    select: data => selectFlatScores(data) as TData,
    refetchInterval: getScoresRefetchInterval,
    ...queryOptions,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, setEndOfListElement };
};

export const useScorer = (scorerId: string) => {
  const client = useMastraClient();
  const [scorer, setScorer] = useState<GetScorerResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchScorer = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await client.getScorer(scorerId);
        setScorer(res);
      } catch (error) {
        setScorer(null);
        const errorObj = error instanceof Error ? error : new Error('Error fetching scorer');
        setError(errorObj);
        console.error('Error fetching scorer', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchScorer();
  }, [scorerId, client]);

  return { scorer, isLoading, error };
};

type ListScorersResponse = Awaited<ReturnType<MastraClient['listScorers']>>;

export const useScorers = <TData = ListScorersResponse>({
  requestContext,
  queryOptions,
}: {
  requestContext?: Record<string, unknown>;
  queryOptions?: MastraQueryOptions<ListScorersResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListScorersResponse, Error, TData>({
    queryKey: ['scorers', requestContext],
    queryFn: () => client.listScorers(requestContext),
    staleTime: 0,
    gcTime: 0,
    ...queryOptions,
  });
};
