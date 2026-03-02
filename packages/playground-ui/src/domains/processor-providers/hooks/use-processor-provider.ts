import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useProcessorProvider = (providerId: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['processor-provider', providerId],
    queryFn: () => client.getProcessorProvider(providerId).details(),
    enabled: options?.enabled !== false,
  });
};
