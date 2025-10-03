import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useInView } from '@/hooks/use-in-view';

const fetchTraceSpanScoresFn = async ({
  traceId,
  spanId,
  page,
  perPage,
}: AITraceScoresFilters & {
  page: number;
  perPage: number;
}) => {
  const client = useMastraClient();

  const res = await client.getScoresBySpan({
    traceId,
    spanId,
    page,
    perPage,
  });

  console.log('---->>>>', { res, traceId, spanId });

  return res.scores || [];
};

export interface AITraceScoresFilters {
  traceId: string;
  spanId: string;
}

export const useTraceSpanScores = ({ traceId, spanId }: AITraceScoresFilters) => {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  console.log('+++++++++', { traceId, spanId });

  const query = useInfiniteQuery({
    queryKey: ['ai-trace-scores', traceId, spanId],
    queryFn: ({ pageParam }) =>
      fetchTraceSpanScoresFn({
        traceId,
        spanId,
        page: pageParam,
        perPage: 25,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.length) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    staleTime: 0,
    gcTime: 0,
    select: data => {
      return data.pages.flatMap(page => page);
    },
    retry: false,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, setEndOfListElement };
};

// @ts-expect-error
export const useTraceSpanScores2 = ({ traceId, spanId, page }) => {
  const client = useMastraClient();
  const [scores, setScores] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('!!!!!!!', { scores, isLoading, traceId, spanId, page });

  useEffect(() => {
    const fetchScores = async () => {
      setIsLoading(true);
      try {
        const res = await client.getScoresBySpan({
          traceId,
          spanId,
          page: page || 0,
          perPage: 10,
        });
        //@ts-expect-error
        setScores(res);
        setIsLoading(false);
      } catch (error) {
        setScores(null);
        setIsLoading(false);
      }
    };

    fetchScores();
  }, [traceId, spanId, page]);

  return { scores, isLoading };
};
