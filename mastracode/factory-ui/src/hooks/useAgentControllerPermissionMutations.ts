import type { PermissionPolicy, PermissionRules, ToolCategory } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

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
  // Latest write per category, so an older write that fails can't undo a newer one.
  const revisions = useRef(new Map<ToolCategory, number>());

  return useMutation({
    mutationFn: ({ category, policy }: { category: ToolCategory; policy: PermissionPolicy }) =>
      requireAgentControllerSession(session).setPermissionForCategory(category, policy),
    // Optimistic: the control moves on click instead of waiting for the refetch.
    onMutate: async ({ category, policy }) => {
      const revision = (revisions.current.get(category) ?? 0) + 1;
      revisions.current.set(category, revision);
      await queryClient.cancelQueries({ queryKey: permissionsQueryKey });
      const previousPermissions = queryClient.getQueryData<PermissionRules>(permissionsQueryKey);

      if (previousPermissions) {
        queryClient.setQueryData<PermissionRules>(permissionsQueryKey, {
          ...previousPermissions,
          categories: { ...previousPermissions.categories, [category]: policy },
        });
      }

      return { previousPermissions, revision };
    },
    // Roll back only this category, and only if no later write to it has started since.
    onError: (_error, { category }, context) => {
      if (!context || revisions.current.get(category) !== context.revision) return;
      const previousPolicy = context.previousPermissions?.categories?.[category];
      if (previousPolicy === undefined) return;
      queryClient.setQueryData<PermissionRules>(permissionsQueryKey, current =>
        current ? { ...current, categories: { ...current.categories, [category]: previousPolicy } } : current,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: permissionsQueryKey }),
  });
}
