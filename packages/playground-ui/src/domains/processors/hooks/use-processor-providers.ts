import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useProcessorProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['processor-providers'],
    queryFn: () => client.getProcessorProviders(),
  });
};
