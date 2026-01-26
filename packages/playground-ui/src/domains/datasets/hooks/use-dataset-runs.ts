import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to list runs for a dataset with optional pagination
 */
export const useDatasetRuns = (datasetId: string, pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-runs', datasetId, pagination],
    queryFn: () => client.listDatasetRuns(datasetId, pagination),
    enabled: Boolean(datasetId),
  });
};

/**
 * Hook to fetch a single dataset run with polling while running
 * Polls every 2 seconds while status is 'running' or 'pending'
 */
export const useDatasetRun = (datasetId: string, runId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-run', datasetId, runId],
    queryFn: () => client.getDatasetRun(datasetId, runId),
    enabled: Boolean(datasetId) && Boolean(runId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: query => {
      // Poll while running, stop when complete
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
  });
};

/**
 * Hook to list results for a dataset run with optional pagination
 */
export const useDatasetRunResults = (datasetId: string, runId: string, pagination?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-run-results', datasetId, runId, pagination],
    queryFn: () => client.listDatasetRunResults(datasetId, runId, pagination),
    enabled: Boolean(datasetId) && Boolean(runId),
  });
};
