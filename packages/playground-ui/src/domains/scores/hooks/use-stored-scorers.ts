import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { CreateStoredScorerParams, UpdateStoredScorerParams, ListStoredScorersParams } from '@mastra/client-js';

/**
 * Hook for fetching a list of stored scorers with optional pagination and filtering
 */
export const useStoredScorers = (params?: ListStoredScorersParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['stored-scorers', params, requestContext],
    queryFn: () => client.listStoredScorers(params, requestContext),
  });
};

/**
 * Hook for fetching a single stored scorer by ID
 */
export const useStoredScorer = (scorerId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['stored-scorer', scorerId, requestContext],
    queryFn: () => (scorerId ? client.getStoredScorer(scorerId, requestContext) : null),
    enabled: Boolean(scorerId),
  });
};

/**
 * Hook for stored scorer mutations (create, update, delete)
 * @param scorerId - Optional scorer ID for update/delete operations
 */
export const useStoredScorerMutations = (scorerId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredScorerParams) => client.createStoredScorer(params, requestContext),
    onSuccess: () => {
      // Invalidate both stored-scorers list and the merged scorers list
      queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['scorers'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredScorerParams) => {
      if (!scorerId) throw new Error('scorerId is required for update');
      return client.updateStoredScorer(scorerId, params, requestContext);
    },
    onSuccess: () => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['scorers'] });
      // Invalidate specific scorer details
      if (scorerId) {
        queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['scorer', scorerId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!scorerId) throw new Error('scorerId is required for delete');
      return client.deleteStoredScorer(scorerId, requestContext);
    },
    onSuccess: () => {
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      queryClient.invalidateQueries({ queryKey: ['scorers'] });
      // Invalidate specific scorer details
      if (scorerId) {
        queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['scorer', scorerId] });
      }
    },
  });

  return {
    createStoredScorer: createMutation,
    updateStoredScorer: updateMutation,
    deleteStoredScorer: deleteMutation,
  };
};
