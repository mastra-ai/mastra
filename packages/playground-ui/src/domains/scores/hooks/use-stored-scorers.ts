import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type {
  CreateStoredScorerParams,
  UpdateStoredScorerParams,
  ListStoredScorersParams,
  ListScorerVersionsParams,
  CreateScorerVersionParams,
} from '@mastra/client-js';

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

/**
 * Hook for fetching scorer versions
 */
export const useScorerVersions = (scorerId?: string, params?: ListScorerVersionsParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['scorer-versions', scorerId, params, requestContext],
    queryFn: () => (scorerId ? client.listScorerVersions(scorerId, params, requestContext) : null),
    enabled: Boolean(scorerId),
  });
};

/**
 * Hook for fetching a single scorer version
 */
export const useScorerVersion = (scorerId?: string, versionId?: string) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['scorer-version', scorerId, versionId, requestContext],
    queryFn: () => (scorerId && versionId ? client.getScorerVersion(scorerId, versionId, requestContext) : null),
    enabled: Boolean(scorerId) && Boolean(versionId),
  });
};

/**
 * Hook for scorer version mutations (create, activate, restore, delete)
 * @param scorerId - Scorer ID for version operations
 */
export const useScorerVersionMutations = (scorerId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createVersionMutation = useMutation({
    mutationFn: (params?: CreateScorerVersionParams) => {
      if (!scorerId) throw new Error('scorerId is required for creating version');
      return client.createScorerVersion(scorerId, params, requestContext);
    },
    onSuccess: () => {
      if (scorerId) {
        queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
      }
    },
  });

  const activateVersionMutation = useMutation({
    mutationFn: (versionId: string) => {
      if (!scorerId) throw new Error('scorerId is required for activating version');
      return client.activateScorerVersion(scorerId, versionId, requestContext);
    },
    onSuccess: () => {
      if (scorerId) {
        queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
        queryClient.invalidateQueries({ queryKey: ['scorers'] });
      }
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: (versionId: string) => {
      if (!scorerId) throw new Error('scorerId is required for restoring version');
      return client.restoreScorerVersion(scorerId, versionId, requestContext);
    },
    onSuccess: () => {
      if (scorerId) {
        queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['stored-scorer', scorerId] });
        queryClient.invalidateQueries({ queryKey: ['stored-scorers'] });
        queryClient.invalidateQueries({ queryKey: ['scorers'] });
      }
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (versionId: string) => {
      if (!scorerId) throw new Error('scorerId is required for deleting version');
      return client.deleteScorerVersion(scorerId, versionId, requestContext);
    },
    onSuccess: () => {
      if (scorerId) {
        queryClient.invalidateQueries({ queryKey: ['scorer-versions', scorerId] });
      }
    },
  });

  return {
    createScorerVersion: createVersionMutation,
    activateScorerVersion: activateVersionMutation,
    restoreScorerVersion: restoreVersionMutation,
    deleteScorerVersion: deleteVersionMutation,
  };
};
