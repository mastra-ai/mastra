import type {
  CreateStoredAgentParams,
  UpdateStoredAgentParams,
  ListStoredAgentsParams,
  StoredAgentResponse,
  ListStoredAgentsResponse,
  StoredAgentDependentsResponse,
  DeleteStoredAgentResponse,
} from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';
import { isModelNotAllowedError } from './is-model-not-allowed';

export const useStoredAgents = <TData = ListStoredAgentsResponse>({
  queryOptions,
  ...params
}: ListStoredAgentsParams & {
  queryOptions?: MastraQueryOptions<ListStoredAgentsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();
  const listParams = Object.keys(params).length > 0 ? params : undefined;

  return useQuery({
    queryKey: ['stored-agents', listParams],
    queryFn: () => client.listStoredAgents(listParams),
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useStoredAgent = <TData = StoredAgentResponse | null>({
  agentId,
  status,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  status?: 'draft' | 'published';
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<StoredAgentResponse | null, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-agent', agentId, status, requestContext],
    queryFn: async () => {
      if (!agentId) return null;
      try {
        return await client.getStoredAgent(agentId).details(requestContext, { status });
      } catch (error) {
        // 404 is expected for code-only agents that haven't been stored yet
        if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    ...queryOptions,
  });
};

export type StoredAgent = StoredAgentResponse;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useStoredAgentDependents = <TData = StoredAgentDependentsResponse>({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<StoredAgentDependentsResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-agent-dependents', agentId, requestContext],
    queryFn: () => client.getStoredAgent(agentId!).dependents(requestContext),
    retry: false,
    ...queryOptions,
  });
};

export const useStoredAgentMutations = ({
  agentId,
  requestContext,
  queryOptions,
}: {
  agentId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: {
    createStoredAgent?: MastraMutationOptions<StoredAgentResponse, CreateStoredAgentParams>;
    updateStoredAgent?: MastraMutationOptions<StoredAgentResponse, UpdateStoredAgentParams>;
    deleteStoredAgent?: MastraMutationOptions<DeleteStoredAgentResponse, void>;
  };
} = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

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
    ...queryOptions?.createStoredAgent,
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
    ...queryOptions?.updateStoredAgent,
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
    ...queryOptions?.deleteStoredAgent,
  });

  return {
    createStoredAgent: createMutation,
    updateStoredAgent: updateMutation,
    deleteStoredAgent: deleteMutation,
  };
};
