import type { CreateStoredScorerParams, UpdateStoredScorerParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useStoredScorer = (scorerId?: string, options?: { status?: 'draft' | 'published' }) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-scorer', scorerId, options?.status],
    queryFn: () => (scorerId ? client.getStoredScorer(scorerId).details(undefined, options) : null),
    enabled: Boolean(scorerId),
  });
};

export const useStoredScorerMutations = (scorerId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredScorerParams) => client.createStoredScorer(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredScorerParams) => {
      if (!scorerId) throw new Error('scorerId is required for update');
      return client.getStoredScorer(scorerId).update(params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
      if (scorerId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!scorerId) throw new Error('scorerId is required for delete');
      return client.getStoredScorer(scorerId).delete();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
      void queryClient.invalidateQueries({ queryKey: ['scorers'] });
      if (scorerId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
      }
    },
  });

  return {
    createStoredScorer: createMutation,
    updateStoredScorer: updateMutation,
    deleteStoredScorer: deleteMutation,
  };
};
