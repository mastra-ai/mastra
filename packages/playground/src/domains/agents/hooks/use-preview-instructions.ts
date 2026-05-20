import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

interface ApiInstructionBlock {
  type: string;
  content?: string;
  id?: string;
  /** Form-format ref blocks use `promptBlockId` instead of `id` */
  promptBlockId?: string;
  rules?: unknown;
}

/**
 * Normalize blocks to API format.
 * Form-format ref blocks have `{ type: 'prompt_block_ref', promptBlockId }`,
 * while API-format blocks have `{ type: 'prompt_block_ref', id }`.
 */
function toApiBlocks(blocks: ApiInstructionBlock[]) {
  return blocks.map(block => {
    if (block.type === 'prompt_block_ref') {
      // Form-format blocks have `promptBlockId` (the storage ID) and `id` (form-internal UUID).
      // API-format blocks have `id` (the storage ID). Prefer promptBlockId when present.
      return { type: 'prompt_block_ref' as const, id: block.promptBlockId ?? block.id };
    }
    return { type: block.type, content: block.content, rules: block.rules };
  });
}

export function usePreviewInstructions(blocks: ApiInstructionBlock[] | undefined, enabled: boolean) {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
    queryKey: ['preview-instructions', blocks, requestContext],
    queryFn: async () => {
      if (!blocks || blocks.length === 0) return '';

      const response = await client.request<{ result: string }>('/stored/agents/preview-instructions', {
        method: 'POST',
        body: { blocks: toApiBlocks(blocks), context: requestContext },
      });

      return response.result;
    },
    enabled: enabled && !!blocks && blocks.length > 0,
  });
}
