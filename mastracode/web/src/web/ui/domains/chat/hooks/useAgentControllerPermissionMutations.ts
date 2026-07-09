import type { PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerPermissionMutationArgs {
  agentControllerId: string;
  resourceId: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetPermissionForCategoryMutation({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: AgentControllerPermissionMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useMutation({
    mutationFn: ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) =>
      requireAgentControllerSession(session).setPermissionForCategory(category, policy),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerPermissions(agentControllerId, resourceId),
      }),
  });
}

export function useSetPermissionForToolMutation({
  agentControllerId,
  resourceId,
  baseUrl = '',
  enabled = true,
}: AgentControllerPermissionMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useMutation({
    mutationFn: ({ toolName, policy }: { toolName: string; policy: PermissionPolicy }) =>
      requireAgentControllerSession(session).setPermissionForTool(toolName, policy),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerPermissions(agentControllerId, resourceId),
      }),
  });
}
