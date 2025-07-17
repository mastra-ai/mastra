import { client } from '@/lib/client';
import { refineTraces } from '../utils/refine-traces';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';

const fetchFn = async ({
  componentName,
  isWorkflow,
  page,
  perPage,
}: {
  componentName: string;
  isWorkflow: boolean;
  page: number;
  perPage: number;
}) => {
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

    const refinedTraces = refineTraces(res?.traces || [], isWorkflow);
    return refinedTraces;
  } catch (error) {
    throw error;
  }
};

export const useTraces = (componentName: string, isWorkflow: boolean = false) => {
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['traces', componentName, isWorkflow],
    queryFn: ({ pageParam }) => fetchFn({ componentName, isWorkflow, page: pageParam, perPage: 100 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.length) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    select: data => data.pages.flat(),
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
