import { useMastraClient } from '@mastra/react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from '@/hooks/use-in-view';

/**
 * Hook to list all datasets with optional pagination
 */
export const useDatasets = (pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['datasets', pagination],
    queryFn: () => client.listDatasets(pagination),
  });
};

/**
 * Hook to fetch a single dataset by ID
 */
export const useDataset = (datasetId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => client.getDataset(datasetId),
    enabled: Boolean(datasetId),
  });
};

const PER_PAGE = 10;

/**
 * Hook to list items in a dataset with infinite scroll pagination and optional search
 */
export const useDatasetItems = (datasetId: string, search?: string) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['dataset-items', datasetId, search],
    queryFn: async ({ pageParam }) => {
      const res = await client.listDatasetItems(datasetId, {
        page: pageParam,
        perPage: PER_PAGE,
        search: search || undefined,
      });
      return res;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.items?.length) {
        return undefined;
      }
      const totalFetched = (lastPageParam + 1) * PER_PAGE;
      if (totalFetched >= lastPage.pagination.total) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    enabled: Boolean(datasetId),
    select: data => {
      return data.pages.flatMap(page => page.items);
    },
    retry: false,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, setEndOfListElement };
};
