import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { CreateIntegrationParams, UpdateIntegrationParams } from '@mastra/client-js';

/**
 * Hook to manage integration mutations (create, update, delete, refresh).
 *
 * @param integrationId - Optional integration ID for update/delete/refresh operations
 * @returns Mutation functions for integration CRUD and refresh operations
 *
 * @example
 * ```tsx
 * const { createIntegration, updateIntegration, deleteIntegration, refreshTools } = useIntegrationMutations();
 *
 * // Create new integration
 * await createIntegration.mutateAsync({
 *   provider: 'composio',
 *   name: 'My Composio Integration',
 *   enabled: true,
 *   selectedToolkits: ['github', 'slack'],
 *   selectedTools: ['github_create_issue', 'slack_send_message']
 * });
 * ```
 *
 * @example
 * ```tsx
 * const { updateIntegration, refreshTools } = useIntegrationMutations('integration-id');
 *
 * // Update integration
 * await updateIntegration.mutateAsync({
 *   name: 'Updated Name',
 *   enabled: false
 * });
 *
 * // Refresh cached tools
 * await refreshTools.mutateAsync();
 * ```
 */
export const useIntegrationMutations = (integrationId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createMutation = useMutation({
    mutationFn: (params: CreateIntegrationParams) => client.createIntegration(params),
    onSuccess: () => {
      // Invalidate integrations list to show newly created integration
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      // Invalidate tools list as integration tools are now available
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateIntegrationParams) => {
      if (!integrationId) throw new Error('integrationId is required for update');
      return client.updateIntegration(integrationId, params);
    },
    onSuccess: () => {
      // Invalidate integrations list
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      // Invalidate specific integration details
      if (integrationId) {
        queryClient.invalidateQueries({ queryKey: ['integration', integrationId] });
      }
      // Invalidate tools list in case toolkit selection changed
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!integrationId) throw new Error('integrationId is required for delete');
      return client.deleteIntegration(integrationId);
    },
    onSuccess: () => {
      // Invalidate integrations list
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      // Invalidate specific integration details
      if (integrationId) {
        queryClient.invalidateQueries({ queryKey: ['integration', integrationId] });
      }
      // Invalidate tools list as integration tools are no longer available
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => {
      if (!integrationId) throw new Error('integrationId is required for refresh');
      return client.refreshIntegrationTools(integrationId);
    },
    onSuccess: () => {
      // Invalidate specific integration details to show updated timestamp
      if (integrationId) {
        queryClient.invalidateQueries({ queryKey: ['integration', integrationId] });
      }
      // Invalidate tools list in case tools changed
      queryClient.invalidateQueries({ queryKey: ['tools'] });
    },
  });

  return {
    createIntegration: createMutation,
    updateIntegration: updateMutation,
    deleteIntegration: deleteMutation,
    refreshTools: refreshMutation,
  };
};
