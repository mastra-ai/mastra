import type { ListBranchesArgs, ListBranchesResponse, ListTracesArgs, ListTracesResponse } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { TraceListMode } from '../trace-filters';
import { useInView } from '@/hooks/use-in-view';
import { is403ForbiddenError } from '@/lib/query-utils';

const fetchTracesFn = async ({
  client,
  page,
  perPage,
  filters,
  listMode = 'traces',
}: TracesFilters & {
  client: ReturnType<typeof useMastraClient>;
  page: number;
  perPage: number;
}) => {
  const params = {
    pagination: {
      page,
      perPage,
    },
    filters,
  };

  if (listMode === 'branches') {
    return client.listBranches(params as ListBranchesArgs);
  }

  return client.listTraces(params as ListTracesArgs);
};

export const TRACES_PER_PAGE = 25;

export interface TracesFilters {
  filters?: ListTracesArgs['filters'] | ListBranchesArgs['filters'];
  listMode?: TraceListMode;
}

/** Returns the next page number if the server indicates more pages are available. */
export function getTracesNextPageParam(
  lastPage: ListTracesResponse | ListBranchesResponse | undefined,
  _allPages: unknown,
  lastPageParam: number,
) {
  if (lastPage?.pagination?.hasMore) {
    return lastPageParam + 1;
  }
  return undefined;
}

type TracesPageResponse = (ListTracesResponse | ListBranchesResponse) & { threadTitles?: Record<string, string> };

function getPageSpans(page: TracesPageResponse) {
  if ('branches' in page) return page.branches ?? [];
  return page.spans ?? [];
}

/** Deduplicates trace/branch rows by traceId + spanId across all loaded pages.
 *  Also merges threadTitles from all pages for thread grouping display. */
export function selectUniqueTraces(data: { pages: TracesPageResponse[] }) {
  const seen = new Set<string>();
  const spans = data.pages
    .flatMap(page => getPageSpans(page))
    .filter(span => {
      const key = `${span.traceId}:${span.spanId}`;
      if (seen.has(key)) return false;
      seen.add(key);
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

export const useTraces = ({ filters, listMode = 'traces' }: TracesFilters) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['traces', listMode, filters],
    queryFn: ({ pageParam }) =>
      fetchTracesFn({
        client,
        page: pageParam,
        perPage: TRACES_PER_PAGE,
        filters,
        listMode,
      }),
    initialPageParam: 0,
    getNextPageParam: getTracesNextPageParam,
    select: selectUniqueTraces,
    placeholderData: keepPreviousData,
    retry: false,
    // Disable polling on 403 to prevent flickering
    refetchInterval: query => (is403ForbiddenError(query.state.error) ? false : 10000),
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, setEndOfListElement };
};
