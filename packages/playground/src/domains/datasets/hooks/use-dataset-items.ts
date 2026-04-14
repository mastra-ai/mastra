import { useInView } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * Hook to fetch a single dataset item by ID
 */
export const useDatasetItem = (datasetId: string, itemId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-item', datasetId, itemId],
    queryFn: () => client.getDatasetItem(datasetId, itemId),
    enabled: Boolean(datasetId) && Boolean(itemId),
    retry: false, // Don't retry 404s for deleted items
  });
};

const PER_PAGE = 10;

/**
 * Hook to list items in a dataset with infinite scroll pagination and optional search
 * @param version - Optional version timestamp to view historical snapshot
 */
export const useDatasetItems = (datasetId: string, search?: string, version?: number | null) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['dataset-items', datasetId, search, version],
    queryFn: async ({ pageParam }) => {
      const res = await client.listDatasetItems(datasetId, {
        page: pageParam,
        perPage: PER_PAGE,
        search: search || undefined,
        version: version || undefined,
      });
      return res;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.items?.length) {
        return undefined;
      }
      const totalFetched = (lastPageParam + 1) * PER_PAGE;
      const total = lastPage?.pagination?.total ?? 0;
      if (totalFetched >= total) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    enabled: Boolean(datasetId),
    retry: false,
  });

  const items = query.data?.pages.flatMap(page => page?.items ?? []) ?? [];
  const total = query.data?.pages[0]?.pagination?.total;

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, data: items, total, setEndOfListElement };
};
