import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/** Explicit page size: server defaults are 20 (global) / 10 (per dataset), which is too small for the list. */
export const EXPERIMENTS_PAGE_SIZE = 100;

/**
 * Experiments for the list page: the global list, or the dataset-scoped list when a dataset filter is active.
 * A dataset's runs may not be in the first page of the global list, so filtering client-side is not enough.
 */
export function useExperimentsForDatasetFilter(datasetId: string | undefined) {
  const client = useMastraClient();
  const pagination = { perPage: EXPERIMENTS_PAGE_SIZE };

  return useQuery({
    // Prefixes match the keys invalidated by dataset/experiment mutations.
    queryKey: datasetId ? ['dataset-experiments', datasetId, pagination] : ['experiments', pagination],
    queryFn: () =>
      datasetId ? client.listDatasetExperiments(datasetId, pagination) : client.listExperiments(pagination),
  });
}
