import { useOptionalRequestContext } from '@mastra/playground-ui/domains/request-context';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export interface UseAgentMessagesProps {
  threadId?: string;
  agentId: string;
  memory: boolean;
}
export const useAgentMessages = ({ threadId, agentId, memory }: UseAgentMessagesProps) => {
  const client = useMastraClient();
  const requestContext = useOptionalRequestContext();

  return useQuery({
    queryKey: ['memory', 'messages', threadId, agentId, requestContext],
    queryFn: async () => {
      if (!threadId) return null;
      const result = await client.listThreadMessages(threadId, {
        agentId,
        requestContext,
        includeSystemReminders: true,
      });
      return result;
    },
    enabled: memory && Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
