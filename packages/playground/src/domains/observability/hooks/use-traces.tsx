import { useMastraClient } from '@mastra/react';
import { ListTracesArgs } from '@mastra/core/storage';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';

const fetchTracesFn = async ({
  client,
  page,
  perPage,
  filters,
}: TracesFilters & {
  client: ReturnType<typeof useMastraClient>;
  page: number;
  perPage: number;
}) => {
  const res = await client.listTraces({
    pagination: {
      page,
      perPage,
    },
    filters,
  });

  return res.spans || [];
};

export interface TracesFilters {
  filters?: ListTracesArgs['filters'];
}

export const useTraces = ({ filters }: TracesFilters) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['traces', filters],
    queryFn: ({ pageParam }) =>
      fetchTracesFn({
        client,
        page: pageParam,
        perPage: 25,
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
