import { useMastraClient } from '@/contexts/mastra-client-context';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useAgent = (agentId: string) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agent', agentId, JSON.stringify(runtimeContext)],
    queryFn: () => client.getAgent(agentId).details(runtimeContext),
    retry: false,
  });
};
