import type { StoredAgentResponse, StoredWorkspaceRef, UpdateStoredAgentParams } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';
import { useStoredAgent } from './use-stored-agents';

/**
 * Hook to read and mutate the workspace reference for a stored agent.
 *
 * The workspace ref is part of the agent snapshot config and can be:
 * - `{ type: 'id', workspaceId }` — references a stored workspace by ID
 * - `{ type: 'inline', config }` — inline workspace config
 * - `undefined` — no workspace assigned
 */
export function useAgentWorkspace({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: {
    updateWorkspace?: MastraMutationOptions<StoredAgentResponse, StoredWorkspaceRef | undefined>;
  };
} = {}) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const { data: agent } = useStoredAgent({ agentId, status: 'draft', queryOptions: { enabled: Boolean(agentId) } });

  const workspace = useMemo((): StoredWorkspaceRef | undefined => {
    if (!agent?.workspace) return undefined;
    // Handle conditional field: if it's an array of variants, take the first value
    if (Array.isArray(agent.workspace)) {
      return agent.workspace[0]?.value as StoredWorkspaceRef | undefined;
    }
    return agent.workspace as StoredWorkspaceRef;
  }, [agent?.workspace]);

  const updateWorkspace = useMutation({
    mutationFn: (ref: StoredWorkspaceRef | undefined) => {
      if (!agentId) throw new Error('agentId is required');
      const params: UpdateStoredAgentParams = { workspace: ref };
      return client.getStoredAgent(agentId).update(params, requestContext);
    },
    onSuccess: () => {
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      }
    },
    ...queryOptions?.updateWorkspace,
  });

  return { workspace, updateWorkspace };
}
