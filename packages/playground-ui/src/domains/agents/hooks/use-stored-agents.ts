import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateStoredAgentParams, CreateStoredAgentParams } from '@mastra/client-js';

/**
 * Hook to fetch a single stored agent by ID
 */
export const useStoredAgent = (agentId?: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-agent', agentId],
    queryFn: () => (agentId ? client.getStoredAgent(agentId).details() : null),
    retry: false,
    enabled: Boolean(agentId),
  });
};

/**
 * Hook to fetch all stored agents with pagination
 */
export const useStoredAgents = (params?: { page?: number; perPage?: number }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-agents', params],
    queryFn: () => client.listStoredAgents(params),
  });
};

/**
 * Hook for stored agent mutations (update, delete)
 */
export const useStoredAgentMutations = (agentId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const updateStoredAgent = useMutation({
    mutationFn: async (params: UpdateStoredAgentParams) => {
      if (!agentId) throw new Error('Agent ID is required');
      return client.getStoredAgent(agentId).update(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
    },
    onError: err => {
      console.error('Error updating stored agent', err);
    },
  });

  const deleteStoredAgent = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error('Agent ID is required');
      return client.getStoredAgent(agentId).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
    },
    onError: err => {
      console.error('Error deleting stored agent', err);
    },
  });

  return {
    updateStoredAgent,
    deleteStoredAgent,
  };
};

/**
 * Hook to create a new stored agent
 */
export const useCreateStoredAgent = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateStoredAgentParams) => {
      return client.createStoredAgent(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
    },
    onError: err => {
      console.error('Error creating stored agent', err);
    },
  });
};
