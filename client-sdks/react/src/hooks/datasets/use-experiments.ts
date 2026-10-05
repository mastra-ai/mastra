import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ListExperimentsResponse = Awaited<ReturnType<MastraClient['listExperiments']>>;

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
