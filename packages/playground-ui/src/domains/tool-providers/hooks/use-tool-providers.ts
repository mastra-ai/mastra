import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useToolProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-providers'],
    queryFn: () => client.listToolProviders(),
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

export const useAllIntegrationTools = () => {
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
  });

  return {
    data: toolsQuery.data ?? [],
    isLoading: isLoadingProviders || toolsQuery.isLoading,
  };
};
