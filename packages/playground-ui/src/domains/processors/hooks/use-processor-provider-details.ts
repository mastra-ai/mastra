import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useProcessorProviderDetails = (providerId: string | null) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processor-provider', providerId],
    queryFn: () => client.getProcessorProvider(providerId!).details(),
    enabled: !!providerId,
  });
};
