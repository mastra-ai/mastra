import type {
  ListStoredPromptBlocksParams,
  ListStoredPromptBlocksResponse,
  StoredPromptBlockResponse,
  CreateStoredPromptBlockParams,
  UpdateStoredPromptBlockParams,
} from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useStoredPromptBlocks = (params?: ListStoredPromptBlocksParams) => {
  const client = useMastraClient();

  return useQuery<ListStoredPromptBlocksResponse>({
    queryKey: ['stored-prompt-blocks', params],
    queryFn: () => client.listStoredPromptBlocks(params),
    placeholderData: previousData => previousData,
  });
};

export const useStoredPromptBlock = (blockId?: string, options?: { status?: 'draft' | 'published' }) => {
  const client = useMastraClient();

  return useQuery<StoredPromptBlockResponse | null>({
    queryKey: ['stored-prompt-block', blockId, options?.status],
    queryFn: () => (blockId ? client.getStoredPromptBlock(blockId).details(undefined, options) : null),
    enabled: Boolean(blockId),
  });
};

export const useStoredPromptBlockMutations = (blockId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredPromptBlockParams) => client.createStoredPromptBlock(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredPromptBlockParams) => {
      if (!blockId) throw new Error('blockId is required for update');
      return client.getStoredPromptBlock(blockId).update(params);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      if (blockId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
        void queryClient.invalidateQueries({ queryKey: ['prompt-block-versions', blockId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!blockId) throw new Error('blockId is required for delete');
      return client.getStoredPromptBlock(blockId).delete();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['stored-prompt-blocks'] });
      if (blockId) {
        void queryClient.invalidateQueries({ queryKey: ['stored-prompt-block', blockId] });
      }
    },
  });

  return {
    createStoredPromptBlock: createMutation,
    updateStoredPromptBlock: updateMutation,
    deleteStoredPromptBlock: deleteMutation,
  };
};
