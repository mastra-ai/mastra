import type { UseQueryResult } from '@tanstack/react-query';
import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const useLLMProviders = <TData = ListAgentsModelProvidersResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<ListAgentsModelProvidersResponse, TData> } = {}): UseQueryResult<
  TData,
  Error
> => {
  const client = useMastraClient();

  return useQuery<ListAgentsModelProvidersResponse, Error, TData>({
    queryKey: ['llm-providers'],
    queryFn: async () => client.listAgentsModelProviders(),
    retry: false,
    ...queryOptions,
  });
};
