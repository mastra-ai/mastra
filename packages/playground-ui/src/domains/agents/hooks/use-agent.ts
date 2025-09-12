import { useMastraClient } from '@/contexts/mastra-client-context';
import { useQuery } from '@tanstack/react-query';

export const useAgent = (agentId: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => client.getAgent(agentId).details(),
    retry: false,
  });
};
