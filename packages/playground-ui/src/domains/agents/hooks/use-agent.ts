import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useAgent = (agentId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agent', agentId, JSON.stringify(requestContext)],
    queryFn: () => (agentId ? client.getAgent(agentId).details(requestContext) : null),
    retry: false,
    enabled: Boolean(agentId),
  });
};
