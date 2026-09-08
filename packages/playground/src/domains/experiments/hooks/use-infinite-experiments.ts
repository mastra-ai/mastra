import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

export const EXPERIMENTS_LIST_PAGE_SIZE = 20;

/**
 * Experiments for the list page, loaded page by page as the end of the list scrolls into view.
 * Reads the global list, or the dataset-scoped list when a dataset filter is active: a dataset's
 * runs may not be in the first pages of the global list, so filtering client-side is not enough.
 */
export function useInfiniteExperiments(datasetId: string | undefined) {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    // Prefixes match the keys invalidated by dataset/experiment mutations.
    queryKey: datasetId ? ['dataset-experiments', datasetId, 'infinite'] : ['experiments', 'infinite'],
    queryFn: ({ pageParam }) => {
      const pagination = { page: pageParam, perPage: EXPERIMENTS_LIST_PAGE_SIZE };
      return datasetId ? client.listDatasetExperiments(datasetId, pagination) : client.listExperiments(pagination);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.experiments?.length || !lastPage.pagination?.hasMore) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    select: data => data.pages.flatMap(page => page?.experiments ?? []),
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query]);

  return { ...query, setEndOfListElement };
}
