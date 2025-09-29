import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useAgent = (agentId?: string) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agent', agentId, JSON.stringify(runtimeContext)],
    queryFn: () => (agentId ? client.getAgent(agentId).details(runtimeContext) : null),
    retry: false,
    enabled: Boolean(agentId),
  });
};
