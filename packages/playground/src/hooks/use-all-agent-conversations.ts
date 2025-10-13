import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { useAgents } from './use-agents';
import { StorageThreadType } from '@mastra/core/memory';

export interface AgentConversationWithMetadata extends StorageThreadType {
  agentId: string;
  agentName: string;
}

export const useAllAgentConversations = () => {
  const { data: agents, isLoading: isLoadingAgents } = useAgents();
  const client = useMastraClient();

  return useQuery({
    queryKey: ['all-agent-conversations'],
    queryFn: async () => {
      if (!agents) return [];

      const allConversations: AgentConversationWithMetadata[] = [];

      // Fetch threads for each agent
      const agentEntries = Object.entries(agents);

      await Promise.all(
        agentEntries.map(async ([agentId, agent]) => {
          try {
            // First check if agent has memory enabled
            const memoryStatus = await client.getMemoryStatus(agentId);

            if (!memoryStatus?.result) {
              // Memory not enabled for this agent
              return;
            }

            // Fetch threads for this agent
            const threads = await client.getMemoryThreads({
              resourceId: agentId,
              agentId,
            });

            if (threads && Array.isArray(threads)) {
              threads.forEach(thread => {
                allConversations.push({
                  ...thread,
                  agentId,
                  agentName: agent.name || agentId,
                });
              });
            }
          } catch (error) {
            console.error(`Error fetching conversations for agent ${agentId}:`, error);
          }
        }),
      );

      // Sort by updatedAt, most recent first
      return allConversations.sort((a, b) => {
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    },
    enabled: !isLoadingAgents && !!agents,
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000,
  });
};
