import type {
  MastraClient,
  ReorderModelListParams,
  UpdateModelInModelListParams,
  UpdateModelParams,
} from '@mastra/client-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { useMastraClient } from '../../mastra-client-context';

type Agent = ReturnType<MastraClient['getAgent']>;
type ModelUpdateResponse = Awaited<ReturnType<Agent['updateModel']>>;

export const useAgents = (options?: { enabled?: boolean }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['agents', requestContext],
    queryFn: () => client.listAgents(requestContext),
    enabled: options?.enabled !== false,
  });
};

export const useUpdateAgentModel = (
  agentId: string,
): UseMutationResult<ModelUpdateResponse, Error, UpdateModelParams> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelParams) => client.getAgent(agentId).updateModel(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model', err);
    },
  });
};

export const useReorderModelList = (
  agentId: string,
): UseMutationResult<ModelUpdateResponse, Error, ReorderModelListParams> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReorderModelListParams) => client.getAgent(agentId).reorderModelList(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error reordering model list', err);
    },
  });
};

export const useUpdateModelInModelList = (
  agentId: string,
): UseMutationResult<ModelUpdateResponse, Error, UpdateModelInModelListParams> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelInModelListParams) =>
      client.getAgent(agentId).updateModelInModelList(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model in model list', err);
    },
  });
};

export const useResetAgentModel = (agentId: string): UseMutationResult<ModelUpdateResponse, Error, void> => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => client.getAgent(agentId).resetModel(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error resetting model', err);
    },
  });
};
