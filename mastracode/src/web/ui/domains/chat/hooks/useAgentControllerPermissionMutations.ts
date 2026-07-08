import type { PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useAgentControllerClient } from './useAgentControllerClient';

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
  const { session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useMutation({
    mutationFn: ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) =>
      session!.setPermissionForCategory(category, policy),
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
  const { session } = useAgentControllerClient({ agentControllerId, resourceId, baseUrl, enabled });

  return useMutation({
    mutationFn: ({ toolName, policy }: { toolName: string; policy: PermissionPolicy }) =>
      session!.setPermissionForTool(toolName, policy),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerPermissions(agentControllerId, resourceId),
      }),
  });
}
