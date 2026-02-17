import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useToolkits = (providerId: string | null) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['tool-provider-toolkits', providerId],
    queryFn: () => client.getToolProvider(providerId!).listToolkits(),
    enabled: !!providerId,
  });
};
