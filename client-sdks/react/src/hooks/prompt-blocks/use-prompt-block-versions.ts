import type {
  ListPromptBlockVersionsParams,
  CreatePromptBlockVersionParams,
  ListPromptBlockVersionsResponse,
  PromptBlockVersionResponse,
  ActivatePromptBlockVersionResponse,
  DeletePromptBlockVersionResponse,
} from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export type { ListPromptBlockVersionsParams, CreatePromptBlockVersionParams };

/**
 * Hook to list versions of a stored prompt block
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const usePromptBlockVersions = <TData = ListPromptBlockVersionsResponse>({
  blockId,
  params,
  requestContext,
  queryOptions,
}: {
  blockId: string;
  params?: ListPromptBlockVersionsParams;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ListPromptBlockVersionsResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListPromptBlockVersionsResponse, Error, TData>({
    queryKey: ['prompt-block-versions', blockId, params, requestContext],
    queryFn: () => client.getStoredPromptBlock(blockId).listVersions(params, requestContext),
    ...queryOptions,
  });
};

/**
 * Hook to get a single version of a stored prompt block
 *
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const usePromptBlockVersion = <TData = PromptBlockVersionResponse>({
  blockId,
  versionId,
  requestContext,
  queryOptions,
}: {
  blockId: string;
  versionId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<PromptBlockVersionResponse, TData>;
}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<PromptBlockVersionResponse, Error, TData>({
    queryKey: ['prompt-block-version', blockId, versionId, requestContext],
    queryFn: () => client.getStoredPromptBlock(blockId).getVersion(versionId, requestContext),
    ...queryOptions,
  });
};

/**
 * Hook to create a new version of a stored prompt block
 */
export const useCreatePromptBlockVersion = ({
  blockId,
  requestContext,
  queryOptions,
}: {
  blockId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<PromptBlockVersionResponse, CreatePromptBlockVersionParams | undefined>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<PromptBlockVersionResponse, Error, CreatePromptBlockVersionParams | undefined>({
    mutationFn: (params?: CreatePromptBlockVersionParams) =>
      client.getStoredPromptBlock(blockId).createVersion(params, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to activate a specific version of a stored prompt block
 */
export const useActivatePromptBlockVersion = ({
  blockId,
  requestContext,
  queryOptions,
}: {
  blockId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<ActivatePromptBlockVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<ActivatePromptBlockVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredPromptBlock(blockId).activateVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to restore a specific version of a stored prompt block (creates a new version from an old one)
 */
export const useRestorePromptBlockVersion = ({
  blockId,
  requestContext,
  queryOptions,
}: {
  blockId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<PromptBlockVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<PromptBlockVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredPromptBlock(blockId).restoreVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
    ...queryOptions,
  });
};

/**
 * Hook to delete a specific version of a stored prompt block
 */
export const useDeletePromptBlockVersion = ({
  blockId,
  requestContext,
  queryOptions,
}: {
  blockId: string;
  requestContext?: Record<string, any>;
  queryOptions?: MastraMutationOptions<DeletePromptBlockVersionResponse, string>;
}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation<DeletePromptBlockVersionResponse, Error, string>({
    mutationFn: (versionId: string) => client.getStoredPromptBlock(blockId).deleteVersion(versionId, requestContext),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
    },
    ...queryOptions,
  });
};
