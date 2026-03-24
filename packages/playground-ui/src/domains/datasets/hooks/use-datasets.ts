import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useInfiniteScrollQuery } from '@/hooks/use-infinite-scroll-query';

/**
 * Hook to list all datasets with infinite scroll pagination
 */
export const useDatasets = () => {
  const client = useMastraClient();

  return useInfiniteScrollQuery({
    queryKey: ['datasets'],
    queryFn: page => client.listDatasets({ page, perPage: 10 }),
    getItems: page => page?.datasets ?? [],
    getTotal: page => page?.pagination?.total ?? 0,
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
