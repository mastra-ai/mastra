import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useAgentsModelProviders = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents-model-providers'],
    queryFn: () => client.listAgentsModelProviders(),
    retry: false,
  });
};
