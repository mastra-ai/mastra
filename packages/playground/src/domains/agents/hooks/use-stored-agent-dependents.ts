import type { StoredAgentDependentsResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

/**
 * Fetches the list of stored agents that reference the given agent as a
 * sub-agent. The result is used by the delete-agent dialog to warn the caller
 * about other agents that will lose this dependency.
 *
 * The query is opt-in via `enabled` so we only hit the endpoint when the
 * confirmation dialog is open.
 */
export const useStoredAgentDependents = (agentId?: string, options?: { enabled?: boolean }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<StoredAgentDependentsResponse>({
    queryKey: ['stored-agent-dependents', agentId, requestContext],
    queryFn: () => {
      if (!agentId) {
        return Promise.resolve({ dependents: [] });
      }
      return client.getStoredAgent(agentId).dependents(requestContext);
    },
    enabled: Boolean(agentId) && (options?.enabled ?? true),
    retry: false,
  });
};
