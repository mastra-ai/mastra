import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { DISCOVERY_STALE_TIME } from './discovery-cache';

type EnvironmentsResponse = Awaited<ReturnType<MastraClient['getEnvironments']>>;
type EnvironmentsData = EnvironmentsResponse['environments'];

export const useEnvironments = <TData = EnvironmentsData>({
  queryOptions,
}: {
  queryOptions?: MastraQueryOptions<EnvironmentsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['observability-environments'],
    queryFn: async (): Promise<EnvironmentsResponse> => {
      try {
        return await client.getEnvironments();
      } catch {
        return { environments: [] };
      }
    },
    select: data => (data?.environments ?? []) as TData,
    retry: false,
    staleTime: DISCOVERY_STALE_TIME,
    ...queryOptions,
  });
};
