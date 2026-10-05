import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type AgentsModelProvidersResponse = Awaited<ReturnType<MastraClient['listAgentsModelProviders']>>;

export const useAgentsModelProviders = <TData = AgentsModelProvidersResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<AgentsModelProvidersResponse, TData> } = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents-model-providers'],
    queryFn: () => client.listAgentsModelProviders(),
    retry: false,
    ...queryOptions,
  });
};
