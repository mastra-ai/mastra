import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useInfiniteScrollQuery } from '@/hooks/use-infinite-scroll-query';

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

/**
 * Hook to list items in a dataset with infinite scroll pagination and optional search
 * @param version - Optional version timestamp to view historical snapshot
 */
export const useDatasetItems = (datasetId: string, search?: string, version?: number | null) => {
  const client = useMastraClient();

  return useInfiniteScrollQuery({
    queryKey: ['dataset-items', datasetId, search, version],
    queryFn: page =>
      client.listDatasetItems(datasetId, {
        page,
        perPage: 10,
        search: search || undefined,
        version: version || undefined,
      }),
    getItems: page => page?.items ?? [],
    getTotal: page => page?.pagination?.total ?? 0,
    enabled: Boolean(datasetId),
  });
};
