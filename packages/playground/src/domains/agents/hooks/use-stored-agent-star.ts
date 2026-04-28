import type { StarToggleResponse, StoredAgentResponse, ListStoredAgentsResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

type StarContext = {
  previousDetail?: StoredAgentResponse | null;
  previousLists: Array<[unknown, ListStoredAgentsResponse | undefined]>;
};

const applyStarToAgent = (agent: StoredAgentResponse, starred: boolean): StoredAgentResponse => {
  const currentCount = agent.starCount ?? 0;
  const nextCount = starred
    ? currentCount + (agent.isStarred ? 0 : 1)
    : Math.max(0, currentCount - (agent.isStarred ? 1 : 0));
  return { ...agent, isStarred: starred, starCount: nextCount };
};

/**
 * Toggle the star state for a stored agent. Optimistically updates both the
 * detail cache (`['stored-agent', id, ...]`) and any list caches
 * (`['stored-agents', ...]`) and rolls back on error.
 */
export const useToggleStoredAgentStar = (agentId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation<StarToggleResponse, Error, { starred: boolean }, StarContext>({
    mutationFn: async ({ starred }) => {
      if (!agentId) throw new Error('agentId is required to toggle star');
      const resource = client.getStoredAgent(agentId);
      return starred ? resource.star(requestContext) : resource.unstar(requestContext);
    },
    onMutate: async ({ starred }) => {
      if (!agentId) return { previousLists: [] };

      // Cancel outgoing refetches so optimistic updates aren't overwritten
      await queryClient.cancelQueries({ queryKey: ['stored-agents'] });
      await queryClient.cancelQueries({ queryKey: ['stored-agent', agentId] });

      // Snapshot detail
      const previousDetail = queryClient.getQueryData<StoredAgentResponse | null>(['stored-agent', agentId]);

      // Optimistically patch every matching list query
      const listQueries = queryClient.getQueriesData<ListStoredAgentsResponse>({ queryKey: ['stored-agents'] });
      const previousLists: StarContext['previousLists'] = [];
      for (const [key, value] of listQueries) {
        previousLists.push([key, value]);
        if (!value?.agents) continue;
        queryClient.setQueryData<ListStoredAgentsResponse>(key as readonly unknown[], {
          ...value,
          agents: value.agents.map(a => (a.id === agentId ? applyStarToAgent(a, starred) : a)),
        });
      }

      // Optimistically patch detail
      if (previousDetail) {
        queryClient.setQueryData<StoredAgentResponse>(
          ['stored-agent', agentId],
          applyStarToAgent(previousDetail, starred),
        );
      }

      return { previousDetail, previousLists };
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      if (agentId && context.previousDetail !== undefined) {
        queryClient.setQueryData(['stored-agent', agentId], context.previousDetail);
      }
      for (const [key, value] of context.previousLists) {
        queryClient.setQueryData(key as readonly unknown[], value);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
      }
    },
  });
};
