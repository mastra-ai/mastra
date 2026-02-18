import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface DatasetExperimentsFilters {
  status?: string;
  targetType?: string;
  targetId?: string;
}

/**
 * Hook to list experiments for a dataset with optional pagination and filters.
 * Filters are applied client-side until the backend supports them.
 */
export const useDatasetExperiments = (
  datasetId: string,
  pagination?: { page?: number; perPage?: number },
  filters?: DatasetExperimentsFilters,
) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-experiments', datasetId, pagination, filters],
    queryFn: () => client.listDatasetExperiments(datasetId, pagination),
    enabled: Boolean(datasetId),
    select: data => {
      if (!filters) return data;
      const filtered = data.experiments.filter(exp => {
        if (filters.status && exp.status !== filters.status) return false;
        if (filters.targetType && exp.targetType !== filters.targetType) return false;
        if (filters.targetId && exp.targetId !== filters.targetId) return false;
        return true;
      });
      return { ...data, experiments: filtered };
    },
  });
};

/**
 * Hook to fetch a single dataset experiment with polling while running
 * Polls every 2 seconds while status is 'running' or 'pending'
 */
export const useDatasetExperiment = (datasetId: string, experimentId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-experiment', datasetId, experimentId],
    queryFn: () => client.getDatasetExperiment(datasetId, experimentId),
    enabled: Boolean(datasetId) && Boolean(experimentId),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: query => {
      // Poll while running, stop when complete
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
  });
};

interface UseDatasetExperimentResultsParams {
  datasetId: string;
  experimentId: string;
  pagination?: { page?: number; perPage?: number };
  experimentStatus?: string;
}

/**
 * Hook to list results for a dataset experiment with optional pagination
 * Polls every 2 seconds while experiment status is 'pending' or 'running'
 */
export const useDatasetExperimentResults = ({
  datasetId,
  experimentId,
  pagination,
  experimentStatus,
}: UseDatasetExperimentResultsParams) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-experiment-results', datasetId, experimentId, pagination],
    queryFn: () => client.listDatasetExperimentResults(datasetId, experimentId, pagination),
    enabled: Boolean(datasetId) && Boolean(experimentId),
    refetchInterval: experimentStatus === 'running' || experimentStatus === 'pending' ? 2000 : false,
  });
};

/**
 * Hook to fetch scores for an experiment, transformed to Record<itemId, ScoreData[]>
 * ScoreData matches ResultsTable expectation: { id, scorerId, score, reason? }
 */
export const useScoresByExperimentId = (experimentId: string) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['dataset-experiment-scores', experimentId],
    queryFn: async () => {
      const response = await client.listScoresByRunId({ runId: experimentId });
      // Transform flat array to Record<entityId, ScoreData[]>
      const grouped: Record<string, Array<{ id: string; scorerId: string; score: number; reason?: string }>> = {};
      for (const row of response.scores) {
        if (!grouped[row.entityId]) {
          grouped[row.entityId] = [];
        }
        grouped[row.entityId].push({
          id: row.id,
          scorerId: row.scorerId,
          score: row.score,
          reason: row.reason ?? undefined,
        });
      }
      return grouped;
    },
    enabled: Boolean(experimentId),
  });
};
