import { useMastraClient } from '@mastra/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ListDatasetRunsParams, CreateDatasetRunParams, ListDatasetRunResultsParams } from '@mastra/client-js';

export const useDatasetRuns = (datasetId: string, params?: ListDatasetRunsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasetRuns', datasetId, params?.page, params?.perPage],
    queryFn: () => client.listDatasetRuns(datasetId, params),
    enabled: !!datasetId,
    // Poll every 2s - TanStack Query will update refetchInterval when data changes
    refetchInterval: query => {
      const hasRunningRuns = query.state.data?.runs?.some(run => run.status === 'running' || run.status === 'pending');
      return hasRunningRuns ? 2000 : false;
    },
  });
};

export const useDatasetRun = (datasetId: string, runId: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['datasetRun', datasetId, runId],
    queryFn: () => client.getDatasetRun(datasetId, runId),
    enabled: !!datasetId && !!runId,
    // Poll every 2s while run is in progress
    refetchInterval: query => {
      const status = query.state.data?.run?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
  });
};

export const useCreateDatasetRun = (datasetId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateDatasetRunParams) => client.createDatasetRun(datasetId, params),
    onSuccess: () => {
      // Invalidate runs list to refetch with new run
      queryClient.invalidateQueries({ queryKey: ['datasetRuns', datasetId] });
    },
  });
};

export const useDatasetRunResults = (
  datasetId: string,
  runId: string,
  params?: ListDatasetRunResultsParams,
  options?: { refetchWhileRunning?: boolean },
) => {
  const client = useMastraClient();
  const { refetchWhileRunning = true } = options ?? {};

  // Get run status to determine if we should poll
  const runQuery = useDatasetRun(datasetId, runId);
  const isRunning = runQuery.data?.run?.status === 'running' || runQuery.data?.run?.status === 'pending';

  return useQuery({
    queryKey: ['datasetRunResults', datasetId, runId, params?.page, params?.perPage, params?.status],
    queryFn: () => client.listDatasetRunResults(datasetId, runId, params),
    enabled: !!datasetId && !!runId,
    // Poll every 2s while run is in progress
    refetchInterval: refetchWhileRunning && isRunning ? 2000 : false,
  });
};
