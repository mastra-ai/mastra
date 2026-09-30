import type { PermissionPolicy, PermissionRules, ToolCategory } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../api/keys';
import {
  createAgentControllerClient,
  requireAgentControllerSession,
} from '../ui/domains/chat/services/agentControllerClient';

interface AgentControllerPermissionMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export function useSetPermissionForCategoryMutation({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
  enabled = true,
}: AgentControllerPermissionMutationArgs) {
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  const permissionsQueryKey = queryKeys.agentControllerPermissions(agentControllerId, resourceId, scope);

  return useMutation({
    mutationFn: ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) =>
      requireAgentControllerSession(session).setPermissionForCategory(category, policy),
    // Optimistic: the control moves on click instead of waiting for the refetch.
    onMutate: async ({ category, policy }) => {
      await queryClient.cancelQueries({ queryKey: permissionsQueryKey });
      const previousPermissions = queryClient.getQueryData<PermissionRules>(permissionsQueryKey);

      if (previousPermissions) {
        queryClient.setQueryData<PermissionRules>(permissionsQueryKey, {
          ...previousPermissions,
          categories: { ...previousPermissions.categories, [category]: policy },
        });
      }

      return { previousPermissions };
    },
    // Roll back only this category, and only if no later write has replaced it since.
    onError: (_error, { category, policy }, context) => {
      const previousPolicy = context?.previousPermissions?.categories?.[category];
      if (previousPolicy === undefined) return;
      queryClient.setQueryData<PermissionRules>(permissionsQueryKey, current =>
        current && current.categories?.[category] === policy
          ? { ...current, categories: { ...current.categories, [category]: previousPolicy } }
          : current,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: permissionsQueryKey }),
  });
}
