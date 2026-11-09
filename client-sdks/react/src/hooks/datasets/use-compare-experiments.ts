import type { CompareExperimentsResponse } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

/**
 * Hook to compare two to ten dataset experiments item by item against a baseline.
 * @param datasetId - ID of the dataset
 * @param experimentIds - IDs of the experiments to compare
 * @param baselineId - ID of the baseline experiment; must be one of `experimentIds` (defaults to the first)
 * @param queryOptions - TanStack Query options, spread last to override defaults
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useCompareExperiments = <TData = CompareExperimentsResponse>({
  datasetId,
  experimentIds,
  baselineId,
  queryOptions,
}: {
  datasetId: string;
  experimentIds: string[];
  baselineId?: string;
  queryOptions?: MastraQueryOptions<CompareExperimentsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['compare-experiments', datasetId, experimentIds, baselineId],
    queryFn: () => client.compareExperiments({ datasetId, experimentIds, baselineId }),
    ...queryOptions,
  });
};
