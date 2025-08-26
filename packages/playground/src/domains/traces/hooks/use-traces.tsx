import { client } from '@/lib/client';
import { refineTraces } from '../utils/refine-traces';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';

const fetchFn = async ({ componentName, page, perPage }: { componentName: string; page: number; perPage: number }) => {
  try {
    const res = await client.getTelemetry({
      attribute: {
        componentName,
      },
      page,
      perPage,
    });
    if (!res.traces) {
      throw new Error('Error fetching traces');
    }
    return res.traces;
  } catch (error) {
    throw error;
  }
};

export const useTraces = (componentName: string, isWorkflow: boolean = false) => {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['traces', componentName, isWorkflow],
    queryFn: ({ pageParam }) => fetchFn({ componentName, page: pageParam, perPage: 100 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.length) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    select: data => refineTraces(data.pages.flat() || [], isWorkflow),
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
