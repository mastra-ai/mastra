import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export interface UseAgentMessagesProps {
  threadId?: string;
  agentId: string;
  memory: boolean;
}
export const useAgentMessages = ({ threadId, agentId, memory }: UseAgentMessagesProps) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['memory', 'messages', threadId, agentId, 'requestContext'],
    queryFn: async () => {
      if (!threadId) return null;
      const result = await client.listThreadMessages(threadId, { agentId, requestContext });
      return result;
    },
    enabled: memory && Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
