import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ListExperimentsResponse = Awaited<ReturnType<MastraClient['listExperiments']>>;
type GetExperimentResponse = Awaited<ReturnType<MastraClient['getExperiment']>>;

/**
 * Hook to list all experiments across all datasets with optional pagination
 */
export const useExperiments = <TData = ListExperimentsResponse>({
  pagination,
  queryOptions,
}: {
  pagination?: { page?: number; perPage?: number };
  queryOptions?: MastraQueryOptions<ListExperimentsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['experiments', pagination],
    queryFn: () => client.listExperiments(pagination),
    ...queryOptions,
  });
};

/**
 * Hook to fetch a single experiment by ID without knowing its dataset
 */
export const useExperiment = <TData = GetExperimentResponse>({
  experimentId,
  queryOptions,
}: {
  experimentId: string;
  queryOptions?: MastraQueryOptions<GetExperimentResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['experiment', experimentId],
    queryFn: () => client.getExperiment(experimentId),
    ...queryOptions,
  });
};
