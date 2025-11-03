import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export const useAgentMessages = ({
  threadId,
  agentId,
  memory,
}: {
  threadId: string;
  agentId: string;
  memory: boolean;
}) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'messages', threadId, agentId, 'runtimeContext'],
    queryFn: () => client.getThreadMessages(threadId, { agentId, runtimeContext }),
    enabled: memory && Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
