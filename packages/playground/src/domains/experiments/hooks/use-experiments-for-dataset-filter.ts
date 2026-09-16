import type { ExperimentTargetType, ListExperimentsParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** Explicit page size: server defaults are 20 (global) / 10 (per dataset), which is too small for the list. */
export const EXPERIMENTS_PAGE_SIZE = 100;

export interface ExperimentTargetFilter {
  targetType?: ExperimentTargetType | '';
  targetId?: string;
}

/**
 * Experiments for the list page: the global list, or the dataset-scoped list when a dataset filter is active.
 * A dataset's runs may not be in the first page of the global list, so filtering client-side is not enough.
 * The optional target filter is applied server-side for the same reason.
 */
export function useExperimentsForDatasetFilter(
  datasetId: string | undefined,
  target?: ExperimentTargetFilter,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const client = useMastraClient();
  const params: ListExperimentsParams = { perPage: EXPERIMENTS_PAGE_SIZE };
  if (target?.targetType) params.targetType = target.targetType;
  if (target?.targetId) params.targetId = target.targetId;

  return useQuery({
    enabled,
    // Prefixes match the keys invalidated by dataset/experiment mutations.
    queryKey: datasetId ? ['dataset-experiments', datasetId, params] : ['experiments', params],
    queryFn: () => (datasetId ? client.listDatasetExperiments(datasetId, params) : client.listExperiments(params)),
  });
}
