import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { CompareRunsParams } from '@mastra/client-js';

type CompareRunsOptions = Omit<CompareRunsParams, 'datasetId' | 'runIdA' | 'runIdB'>;

/**
 * Hook to compare two dataset runs for regression detection
 * @param datasetId - ID of the dataset
 * @param runIdA - ID of the first run (baseline)
 * @param runIdB - ID of the second run (comparison)
 * @param options - Optional thresholds for regression detection
 */
export const useCompareRuns = (datasetId: string, runIdA: string, runIdB: string, options?: CompareRunsOptions) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['compare-runs', datasetId, runIdA, runIdB, options],
    queryFn: () => client.compareRuns({ datasetId, runIdA, runIdB, ...options }),
    enabled: Boolean(datasetId) && Boolean(runIdA) && Boolean(runIdB),
  });
};
