import type { UseQueryResult } from '@tanstack/react-query';
import type { CompareExperimentsParams, CompareExperimentsResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type CompareExperimentsOptions = Omit<CompareExperimentsParams, 'datasetId' | 'experimentIdA' | 'experimentIdB'>;

/**
 * Hook to compare two dataset experiments for regression detection
 * @param datasetId - ID of the dataset
 * @param experimentIdA - ID of the first experiment (baseline)
 * @param experimentIdB - ID of the second experiment (comparison)
 * @param options - Optional thresholds for regression detection
 * @param queryOptions - TanStack Query options, spread last to override defaults
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useCompareExperiments = <TData = CompareExperimentsResponse>({
  datasetId,
  experimentIdA,
  experimentIdB,
  options,
  queryOptions,
}: {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
  options?: CompareExperimentsOptions;
  queryOptions?: MastraQueryOptions<CompareExperimentsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['compare-experiments', datasetId, experimentIdA, experimentIdB, options],
    queryFn: () => client.compareExperiments({ datasetId, experimentIdA, experimentIdB, ...options }),
    ...queryOptions,
  });
};
