import type { CreateStoredAgentParams, UpdateStoredAgentParams, ListStoredAgentsParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isModelNotAllowedError } from '@/domains/builder';
import { usePlaygroundStore } from '@/store/playground-store';

export const useStoredAgents = (params?: ListStoredAgentsParams, options?: { enabled?: boolean }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-agents', params],
    queryFn: () => client.listStoredAgents(params),
    enabled: options?.enabled ?? true,
  });
};

export const useStoredAgent = (agentId?: string, options?: { status?: 'draft' | 'published'; enabled?: boolean }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();
  const { enabled = true, ...queryOptions } = options ?? {};

  return useQuery({
    queryKey: ['stored-agent', agentId, queryOptions.status, requestContext],
    queryFn: async () => {
      if (!agentId) return null;
      try {
        return await client.getStoredAgent(agentId).details(requestContext, queryOptions);
      } catch (error) {
        // 404 is expected for code-only agents that haven't been stored yet
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(agentId) && enabled,
    retry: false,
  });
};

export type StoredAgent = NonNullable<ReturnType<typeof useStoredAgent>['data']>;

export const useStoredAgentMutations = (agentId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  // If the server rejects with HTTP 422 + MODEL_NOT_ALLOWED the admin policy
  // has likely changed under us — refresh the cached settings so the UI
  // re-renders against the latest server truth.
  const invalidateBuilderSettingsOnPolicyReject = (err: unknown) => {
    if (isModelNotAllowedError(err)) {
      void queryClient.invalidateQueries({ queryKey: ['builder-settings'] });
    }
  };

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredAgentParams) => client.createStoredAgent(params),
    onSuccess: created => {
      // Prime the per-agent details cache with the response so the next page
      // (the edit page) can render the agent on first paint without a refetch.
      // The starter relies on this to immediately mount the conversation panel
      // and dispatch the user's initial message.
      queryClient.setQueryData(['stored-agent', created.id, 'draft', requestContext], created);
      queryClient.setQueryData(['stored-agent', created.id, undefined, requestContext], created);
      // Invalidate both stored-agents list and the merged agents list
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Invalidate the merged agent details so the freshly-created id resolves
      // instead of staying stuck on the initial `null` from the 404 lookup.
      void queryClient.invalidateQueries({ queryKey: ['agent', created.id] });
    },
    onError: invalidateBuilderSettingsOnPolicyReject,
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredAgentParams) => {
      if (!agentId) throw new Error('agentId is required for update');
      return client.getStoredAgent(agentId).update(params, requestContext);
    },
    onSuccess: () => {
      // Invalidate lists
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Invalidate specific agent details
      if (agentId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      }
    },
    onError: invalidateBuilderSettingsOnPolicyReject,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!agentId) throw new Error('agentId is required for delete');
      return client.getStoredAgent(agentId).delete(requestContext);
    },
    onSuccess: () => {
      // Invalidate lists so the agents list page refetches without the deleted entry
      void queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      // Drop the deleted entity from the cache so active observers don't refetch a 404
      if (agentId) {
        queryClient.removeQueries({ queryKey: ['stored-agent', agentId] });
        queryClient.removeQueries({ queryKey: ['agent', agentId] });
      }
    },
  });

  return {
    createStoredAgent: createMutation,
    updateStoredAgent: updateMutation,
    deleteStoredAgent: deleteMutation,
  };
};
