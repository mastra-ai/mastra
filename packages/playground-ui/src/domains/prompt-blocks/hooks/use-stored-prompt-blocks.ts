import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type {
  ListStoredPromptBlocksParams,
  ListStoredPromptBlocksResponse,
  StoredPromptBlockResponse,
  CreateStoredPromptBlockParams,
  UpdateStoredPromptBlockParams,
} from '@mastra/client-js';

export const useStoredPromptBlocks = (params?: ListStoredPromptBlocksParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<ListStoredPromptBlocksResponse>({
    queryKey: ['stored-prompt-blocks', params, requestContext],
    queryFn: () => client.listStoredPromptBlocks(params),
  });
};

export const useStoredPromptBlock = (blockId?: string, options?: { status?: 'draft' | 'published' }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<StoredPromptBlockResponse | null>({
    queryKey: ['stored-prompt-block', blockId, options?.status, requestContext],
    queryFn: () => (blockId ? client.getStoredPromptBlock(blockId).details(requestContext, options) : null),
    enabled: Boolean(blockId),
  });
};

export const useStoredPromptBlockMutations = (blockId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredPromptBlockParams) => client.createStoredPromptBlock(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredPromptBlockParams) => {
      if (!blockId) throw new Error('blockId is required for update');
      return client.getStoredPromptBlock(blockId).update(params, requestContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      if (blockId) {
        queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
        queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!blockId) throw new Error('blockId is required for delete');
      return client.getStoredPromptBlock(blockId).delete(requestContext);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      if (blockId) {
        queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
      }
    },
  });

  return {
    createStoredPromptBlock: createMutation,
    updateStoredPromptBlock: updateMutation,
    deleteStoredPromptBlock: deleteMutation,
  };
};
