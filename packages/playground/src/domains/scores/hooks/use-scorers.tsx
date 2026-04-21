import type { GetScorerResponse, ListScoresResponse } from '@mastra/client-js';
import { toast, useInView } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useMergedRequestContext } from '@/domains/request-context';

const SCORES_PER_PAGE = 25;

type UseScoresByScorerIdProps = {
  scorerId: string;
  entityId?: string;
  entityType?: string;
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

export const useScoresByScorerId = ({ scorerId, entityId, entityType }: UseScoresByScorerIdProps) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['scores', scorerId, entityId, entityType],
    queryFn: ({ pageParam }) =>
      client.listScoresByScorerId({ scorerId, page: pageParam, perPage: SCORES_PER_PAGE, entityId, entityType }),
    initialPageParam: 0,
    getNextPageParam: getScoresNextPageParam,
    select: selectFlatScores,
    refetchInterval: 5000,
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
        toast.error('Error fetching scorer');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchScorer();
  }, [scorerId, client]);

  return { scorer, isLoading, error };
};

export const useScorers = () => {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['scorers', requestContext],
    queryFn: () => client.listScorers(requestContext),
    staleTime: 0,
    gcTime: 0,
  });
};
