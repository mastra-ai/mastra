import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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
