import type {
  ListPromptBlockVersionsParams,
  CreatePromptBlockVersionParams,
  ListPromptBlockVersionsResponse,
  PromptBlockVersionResponse,
  ActivatePromptBlockVersionResponse,
  DeletePromptBlockVersionResponse,
} from '@mastra/client-js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export type { ListPromptBlockVersionsParams, CreatePromptBlockVersionParams };

/**
 * Hook to list versions of a stored prompt block
 */
export const usePromptBlockVersions = (
  {
    blockId,
    params,
  }: {
    blockId: string;
    params?: ListPromptBlockVersionsParams;
  },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();

  return useQuery<ListPromptBlockVersionsResponse>({
    queryKey: ['prompt-block-versions', blockId, params, requestContext],
    queryFn: () => client.getStoredPromptBlock(blockId).listVersions(params, requestContext),
    enabled: !!blockId,
  });
};

/**
 * Hook to get a single version of a stored prompt block
 */
export const usePromptBlockVersion = (
  { blockId, versionId }: { blockId: string; versionId: string },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();

  return useQuery<PromptBlockVersionResponse>({
    queryKey: ['prompt-block-version', blockId, versionId, requestContext],
    queryFn: () => client.getStoredPromptBlock(blockId).getVersion(versionId, requestContext),
    enabled: !!blockId && !!versionId,
  });
};

/**
 * Hook to create a new version of a stored prompt block
 */
export const useCreatePromptBlockVersion = ({ blockId }: { blockId: string }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<PromptBlockVersionResponse, Error, CreatePromptBlockVersionParams | undefined>({
    mutationFn: (params?: CreatePromptBlockVersionParams) =>
      client.getStoredPromptBlock(blockId).createVersion(params, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
  });
};

/**
 * Hook to activate a specific version of a stored prompt block
 */
export const useActivatePromptBlockVersion = (
  { blockId }: { blockId: string },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivatePromptBlockVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredPromptBlock(blockId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
  });
};

/**
 * Hook to restore a specific version of a stored prompt block (creates a new version from an old one)
 */
export const useRestorePromptBlockVersion = (
  { blockId }: { blockId: string },
  requestContext?: Record<string, any>,
) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<PromptBlockVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredPromptBlock(blockId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
  });
};

/**
 * Hook to delete a specific version of a stored prompt block
 */
export const useDeletePromptBlockVersion = ({ blockId }: { blockId: string }, requestContext?: Record<string, any>) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeletePromptBlockVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredPromptBlock(blockId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
  });
};
