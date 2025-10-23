import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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

  return useQuery({
    queryKey: ['memory', 'messages', threadId, agentId],
    queryFn: () => client.getThreadMessages(threadId, { agentId, format: 'aiv5-ui' }),
    enabled: memory && Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
