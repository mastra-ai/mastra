import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { workflowDefinitionsQueryKey } from './use-workflow-definitions';

export const workflowDefinitionVersionsQueryKey = (id: string) =>
  [...workflowDefinitionsQueryKey, id, 'versions'] as const;

export interface UseWorkflowDefinitionVersionsParams {
  page?: number;
  perPage?: number;
}

export function useWorkflowDefinitionVersions(
  definitionId: string | undefined,
  params?: UseWorkflowDefinitionVersionsParams,
) {
  const client = useMastraClient();

  return useQuery({
    queryKey: definitionId ? [...workflowDefinitionVersionsQueryKey(definitionId), params] : [],
    queryFn: async () => {
      if (!definitionId) throw new Error('Definition ID is required');
      const definition = client.getWorkflowDefinition(definitionId);
      return definition.listVersions(params);
    },
    enabled: !!definitionId,
  });
}

export function useWorkflowDefinitionVersion(definitionId: string | undefined, versionId: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: definitionId && versionId ? [...workflowDefinitionVersionsQueryKey(definitionId), versionId] : [],
    queryFn: async () => {
      if (!definitionId || !versionId) throw new Error('Definition ID and Version ID are required');
      const definition = client.getWorkflowDefinition(definitionId);
      return definition.getVersion(versionId);
    },
    enabled: !!definitionId && !!versionId,
  });
}

export interface CreateVersionParams {
  name?: string;
  changeMessage?: string;
}

export function useWorkflowDefinitionVersionMutations(definitionId: string | undefined) {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createVersion = useMutation({
    mutationFn: async (params?: CreateVersionParams) => {
      if (!definitionId) throw new Error('Definition ID is required');
      const definition = client.getWorkflowDefinition(definitionId);
      return definition.createVersion(params);
    },
    onSuccess: () => {
      if (definitionId) {
        queryClient.invalidateQueries({
          queryKey: workflowDefinitionVersionsQueryKey(definitionId),
        });
      }
    },
  });

  const activateVersion = useMutation({
    mutationFn: async (versionId: string) => {
      if (!definitionId) throw new Error('Definition ID is required');
      const definition = client.getWorkflowDefinition(definitionId);
      return definition.activateVersion(versionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowDefinitionsQueryKey });
      if (definitionId) {
        queryClient.invalidateQueries({
          queryKey: [...workflowDefinitionsQueryKey, definitionId],
        });
        queryClient.invalidateQueries({
          queryKey: workflowDefinitionVersionsQueryKey(definitionId),
        });
      }
    },
  });

  const deleteVersion = useMutation({
    mutationFn: async (versionId: string) => {
      if (!definitionId) throw new Error('Definition ID is required');
      const definition = client.getWorkflowDefinition(definitionId);
      return definition.deleteVersion(versionId);
    },
    onSuccess: () => {
      if (definitionId) {
        queryClient.invalidateQueries({
          queryKey: workflowDefinitionVersionsQueryKey(definitionId),
        });
      }
    },
  });

  return {
    createVersion,
    activateVersion,
    deleteVersion,
  };
}

export function useCompareWorkflowDefinitionVersions(
  definitionId: string | undefined,
  versionId1: string | undefined,
  versionId2: string | undefined,
) {
  const client = useMastraClient();

  return useQuery({
    queryKey:
      definitionId && versionId1 && versionId2
        ? [...workflowDefinitionVersionsQueryKey(definitionId), 'compare', versionId1, versionId2]
        : [],
    queryFn: async () => {
      if (!definitionId || !versionId1 || !versionId2) {
        throw new Error('Definition ID and both Version IDs are required');
      }
      const definition = client.getWorkflowDefinition(definitionId);
      return definition.compareVersions(versionId1, versionId2);
    },
    enabled: !!definitionId && !!versionId1 && !!versionId2,
  });
}
