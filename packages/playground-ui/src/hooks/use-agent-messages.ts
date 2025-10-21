import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useAgentMessages = ({ threadId, agentId }: { threadId: string; agentId: string }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['memory', 'messages', threadId, agentId],
    queryFn: () => client.getThreadMessages(threadId, { agentId }),
    enabled: Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
