import { usePlaygroundStore } from '@/store/playground-store';
import { ReorderModelListParams, UpdateModelInModelListParams, UpdateModelParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';

export const useAgents = () => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['agents', JSON.stringify(requestContext)],
    queryFn: () => client.listAgents(requestContext),
  });
};

export const useUpdateAgentModel = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelParams) => client.getAgent(agentId).updateModel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model', err);
      toast.error('Failed to update model');
    },
  });
};

export const useReorderModelList = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ReorderModelListParams) => client.getAgent(agentId).reorderModelList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error reordering model list', err);
      toast.error('Failed to reorder model list');
    },
  });
};

export const useUpdateModelInModelList = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateModelInModelListParams) =>
      client.getAgent(agentId).updateModelInModelList(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error updating model in model list', err);
      toast.error('Failed to update model in model list');
    },
  });
};

export const useResetAgentModel = (agentId: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => client.getAgent(agentId).resetModel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
    onError: err => {
      console.error('Error resetting model', err);
      toast.error('Failed to reset model');
    },
  });
};
