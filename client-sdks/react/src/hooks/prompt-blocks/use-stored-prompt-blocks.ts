import type { MastraClient,
  ListStoredPromptBlocksParams,
  ListStoredPromptBlocksResponse,
  StoredPromptBlockResponse,
  CreateStoredPromptBlockParams,
  UpdateStoredPromptBlockParams } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions, MastraQueryOptions } from '../shared/query-options';

export const useStoredPromptBlocks = <TData = ListStoredPromptBlocksResponse>({
  requestContext,
  queryOptions,
  ...params
}: ListStoredPromptBlocksParams & {
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<ListStoredPromptBlocksResponse, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<ListStoredPromptBlocksResponse, Error, TData>({
    queryKey: ['stored-prompt-blocks', params, requestContext],
    queryFn: () => client.listStoredPromptBlocks(params),
    placeholderData: (previousData: ListStoredPromptBlocksResponse | undefined) => previousData,
    ...queryOptions,
  });
};

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export const useStoredPromptBlock = <TData = StoredPromptBlockResponse | null>({
  blockId,
  status,
  requestContext,
  queryOptions,
}: {
  blockId?: string;
  status?: 'draft' | 'published';
  requestContext?: Record<string, any>;
  queryOptions?: MastraQueryOptions<StoredPromptBlockResponse | null, TData>;
} = {}): UseQueryResult<TData, Error> => {
  const client = useMastraClient();

  return useQuery<StoredPromptBlockResponse | null, Error, TData>({
    queryKey: ['stored-prompt-block', blockId, status, requestContext],
    queryFn: () => (blockId ? client.getStoredPromptBlock(blockId).details(requestContext, { status }) : null),
    ...queryOptions,
  });
};

type DeleteStoredPromptBlockResponse = Awaited<ReturnType<ReturnType<MastraClient['getStoredPromptBlock']>['delete']>>;

export const useStoredPromptBlockMutations = ({
  blockId,
  requestContext,
  queryOptions,
}: {
  blockId?: string;
  requestContext?: Record<string, any>;
  queryOptions?: {
    createStoredPromptBlock?: MastraMutationOptions<StoredPromptBlockResponse, CreateStoredPromptBlockParams>;
    updateStoredPromptBlock?: MastraMutationOptions<StoredPromptBlockResponse, UpdateStoredPromptBlockParams>;
    deleteStoredPromptBlock?: MastraMutationOptions<DeleteStoredPromptBlockResponse, void>;
  };
} = {}) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredPromptBlockParams) => client.createStoredPromptBlock(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
    },
    ...queryOptions?.createStoredPromptBlock,
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredPromptBlockParams) => {
      if (!blockId) throw new Error('blockId is required for update');
      return client.getStoredPromptBlock(blockId).update(params, requestContext);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      if (blockId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
        void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      }
    },
    ...queryOptions?.updateStoredPromptBlock,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!blockId) throw new Error('blockId is required for delete');
      return client.getStoredPromptBlock(blockId).delete(requestContext);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      if (blockId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
      }
    },
    ...queryOptions?.deleteStoredPromptBlock,
  });

  return {
    createStoredPromptBlock: createMutation,
    updateStoredPromptBlock: updateMutation,
    deleteStoredPromptBlock: deleteMutation,
  };
};
