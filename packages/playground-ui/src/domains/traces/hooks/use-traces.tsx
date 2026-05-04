import type { ListTracesArgs, ListTracesResponse } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from '@/hooks/use-in-view';

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

type TracesPageResponse = ListTracesResponse & { threadTitles?: Record<string, string> };

/** Deduplicates traces by traceId across all loaded pages, keeping the first occurrence.
 *  Also merges threadTitles from all pages for thread grouping display. */
export function selectUniqueTraces(data: { pages: TracesPageResponse[] }) {
  const seen = new Set<string>();
  const spans = data.pages
    .flatMap(page => page.spans ?? [])
    .filter(span => {
      if (seen.has(span.traceId)) return false;
      seen.add(span.traceId);
      return true;
    });

  const threadTitles: Record<string, string> = {};
  for (const page of data.pages) {
    if (page.threadTitles) {
      Object.assign(threadTitles, page.threadTitles);
    }
  }

  return { spans, threadTitles };
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
    placeholderData: keepPreviousData,
    retry: false,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, setEndOfListElement };
};
