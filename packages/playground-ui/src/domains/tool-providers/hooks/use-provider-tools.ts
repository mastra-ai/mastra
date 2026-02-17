import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useProviderTools = (providerId: string | null, params?: { toolkit?: string; search?: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-provider-tools', providerId, params?.toolkit, params?.search],
    queryFn: () => client.getToolProvider(providerId!).listTools(params),
    enabled: !!providerId,
  });
};
