import { client } from '@/lib/client';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';

const fetchAITraceScoresFn = async ({
  traceId,
  spanId,
  page,
  perPage,
}: AITraceScoresFilters & {
  page: number;
  perPage: number;
}) => {
  const res = await client.getScoresBySpan({
    traceId,
    spanId,
    page,
    perPage,
  });

  return res.scores || [];
};

export interface AITraceScoresFilters {
  traceId: string;
  spanId: string;
}

export const useAITraceScores = ({ traceId, spanId }: AITraceScoresFilters) => {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['ai-trace-scores', traceId, spanId],
    queryFn: ({ pageParam }) =>
      fetchAITraceScoresFn({
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
