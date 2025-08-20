import { client } from '@/lib/client';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';

const fetchAITracesFn = async ({
  page,
  perPage,
  name,
  spanType,
  dateRange,
  attributes,
}: {
  page: number;
  perPage: number;
  name?: string;
  spanType?: number;
  dateRange?: {
    start?: string | Date;
    end?: string | Date;
  };
  attributes?: Record<string, any>;
}) => {
  try {
    const res = await client.getAITraces({
      page,
      perPage,
      name,
      spanType,
      dateRange,
      attributes,
    });

    if (!res.spans) {
      throw new Error('Error fetching AI traces');
    }
    return res.spans;
  } catch (error) {
    throw error;
  }
};

export const useAITraces = (filters?: {
  name?: string;
  spanType?: number;
  dateRange?: {
    start?: string | Date;
    end?: string | Date;
  };
  attributes?: Record<string, any>;
}) => {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['ai-traces', filters],
    queryFn: ({ pageParam }) =>
      fetchAITracesFn({
        page: pageParam,
        perPage: 100,
        ...filters,
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
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, setEndOfListElement };
};
