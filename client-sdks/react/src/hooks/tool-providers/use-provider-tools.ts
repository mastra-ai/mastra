import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ProviderToolsResponse = Awaited<ReturnType<ReturnType<MastraClient['getToolProvider']>['listTools']>>;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useProviderTools = <TData = ProviderToolsResponse>({
  providerId,
  params,
  queryOptions,
}: {
  providerId: string | null;
  params?: { toolkit?: string; search?: string };
  queryOptions?: MastraQueryOptions<ProviderToolsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-provider-tools', providerId, params?.toolkit, params?.search],
    queryFn: () => client.getToolProvider(providerId!).listTools(params),
    ...queryOptions,
  });
};
