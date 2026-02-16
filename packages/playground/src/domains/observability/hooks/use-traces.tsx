import { useMastraClient } from '@mastra/react';
import { ListTracesArgs, ListTracesResponse } from '@mastra/core/storage';
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

export const TRACES_PER_PAGE = 25;

export interface TracesFilters {
  filters?: ListTracesArgs['filters'];
}

/** Returns the next page number if the server indicates more pages are available. */
export function getTracesNextPageParam(
  lastPage: ListTracesResponse | undefined,
  _allPages: unknown,
  lastPageParam: number,
) {
  if (lastPage?.pagination?.hasMore) {
    return lastPageParam + 1;
  }
  return undefined;
}

/** Deduplicates traces by traceId across all loaded pages, keeping the first occurrence. */
export function selectUniqueTraces(data: { pages: ListTracesResponse[] }) {
  const seen = new Set<string>();
  return data.pages
    .flatMap(page => page.spans ?? [])
    .filter(span => {
      if (seen.has(span.traceId)) return false;
      seen.add(span.traceId);
      return true;
    });
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
        perPage: TRACES_PER_PAGE,
        filters,
      }),
    initialPageParam: 0,
    getNextPageParam: getTracesNextPageParam,
    select: selectUniqueTraces,
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
