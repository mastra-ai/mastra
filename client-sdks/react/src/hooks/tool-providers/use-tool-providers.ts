import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

type ToolProvidersResponse = Awaited<ReturnType<MastraClient['listToolProviders']>>;

export const useToolProviders = <TData = ToolProvidersResponse>({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<ToolProvidersResponse, TData> } = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-providers'],
    queryFn: () => client.listToolProviders(),
    ...queryOptions,
  });
};

export interface IntegrationTool {
  slug: string;
  name: string;
  description?: string;
  toolkit?: string;
  providerId: string;
  providerName: string;
}

export const useAllIntegrationTools = ({
  queryOptions,
}: { queryOptions?: MastraQueryOptions<IntegrationTool[]> } = {}) => {
  const client = useMastraClient();
  const { data: providersData, isLoading: isLoadingProviders } = useToolProviders();
  const providers = providersData?.providers ?? [];

  const toolsQuery = useQuery({
    queryKey: ['integration-tools-all', providers.map(p => p.id)],
    queryFn: async () => {
      const results: IntegrationTool[] = [];

      for (const provider of providers) {
        const response = await client.getToolProvider(provider.id).listTools();
        for (const tool of response.data) {
          results.push({
            ...tool,
            providerId: provider.id,
            providerName: provider.name,
          });
        }
      }

      return results;
    },
    enabled: providers.length > 0,
    ...queryOptions,
  });

  return {
    data: toolsQuery.data ?? [],
    isLoading: isLoadingProviders || toolsQuery.isLoading,
  };
};
