import type { PermissionPolicy, ToolCategory } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../services/agentControllerClient';

interface AgentControllerPermissionMutationArgs {
  agentControllerId: string;
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetPermissionForCategoryMutation({
  agentControllerId,
  resourceId,
  projectPath,
  baseUrl = '',
  enabled = true,
}: AgentControllerPermissionMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled,
  });

  return useMutation({
    mutationFn: ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) =>
      requireAgentControllerSession(session).setPermissionForCategory(category, policy),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerPermissions(agentControllerId, resourceId, projectPath),
      }),
  });
}
