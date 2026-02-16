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
  return client.listTraces({
    pagination: {
      page,
      perPage,
    },
    filters,
  });
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
      if (lastPage?.pagination?.hasMore) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    select: data => {
      const seen = new Set<string>();
      return data.pages
        .flatMap(page => page.spans ?? [])
        .filter(span => {
          if (seen.has(span.traceId)) return false;
          seen.add(span.traceId);
          return true;
        });
    },
    retry: false,
    refetchInterval: 3000,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, setEndOfListElement };
};
