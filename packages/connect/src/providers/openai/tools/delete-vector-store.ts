// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteVectorStoreInputSchema = z.object({
  vector_store_id: z.string().describe('The ID of the vector store to delete. Example: "vs_abc123"'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.literal('vector_store.deleted'),
  deleted: z.boolean(),
});

export const deleteVectorStoreOutputSchema = z.object({
  id: z.string().describe('The ID of the deleted vector store'),
  object: z.literal('vector_store.deleted').describe('The object type'),
  deleted: z.boolean().describe('Whether the vector store was successfully deleted'),
});

export function deleteVectorStoreTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_delete_vector_store',
    description: 'Delete a vector store from OpenAI',
    inputSchema: deleteVectorStoreInputSchema,
    outputSchema: deleteVectorStoreOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteVectorStoreOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/vector-stores/delete
      const response = await platformProxy.delete({
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: 'Failed to delete vector store',
          vector_store_id: input.vector_store_id,
        });
      }

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        id: providerData.id,
        object: providerData.object,
        deleted: providerData.deleted,
      };
    },
  });
}
