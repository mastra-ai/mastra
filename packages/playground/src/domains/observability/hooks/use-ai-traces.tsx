import { client } from '@/lib/client';
import { AITracesPaginatedArg } from '@mastra/core';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';

const fetchAITracesFn = async ({
  page,
  perPage,
  dateRange,
  filters,
}: AITracesFilters & {
  page: number;
  perPage: number;
}) => {
  try {
    const res = await client.getAITraces({
      pagination: {
        page,
        perPage,
        dateRange,
      },
      filters,
    });

    if (!res.spans) {
      throw new Error('Error fetching AI traces');
    }
    return res.spans;
  } catch (error) {
    throw error;
  }
};

export interface AITracesFilters {
  filters: AITracesPaginatedArg['filters'];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export const useAITraces = ({ filters, dateRange }: AITracesFilters) => {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['ai-traces', filters, dateRange],
    queryFn: ({ pageParam }) =>
      fetchAITracesFn({
        page: pageParam,
        perPage: 100,
        dateRange,
        filters,
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
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, setEndOfListElement };
};
