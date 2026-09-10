// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteVectorStoreFileInputSchema = z.object({
  vector_store_id: z.string().describe('The ID of the vector store. Example: "vs_abc123"'),
  file_id: z.string().describe('The ID of the file to remove from the vector store. Example: "file-abc123"'),
});

const ProviderResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  deleted: z.boolean(),
});

export const deleteVectorStoreFileOutputSchema = z.object({
  id: z.string(),
  object: z.literal('vector_store.file.deleted'),
  deleted: z.boolean(),
});

export function deleteVectorStoreFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_delete_vector_store_file',
    description: 'Remove a file from a vector store (does not delete the underlying file object)',
    inputSchema: deleteVectorStoreFileInputSchema,
    outputSchema: deleteVectorStoreFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteVectorStoreFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://platform.openai.com/docs/api-reference/vector-stores-files/deleteFile
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}/files/${encodeURIComponent(input.file_id)}`,
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      if (!providerData.deleted) {
        throw new platformProxy.ActionError({
          type: 'deletion_failed',
          message: 'Failed to delete vector store file',
          vector_store_id: input.vector_store_id,
          file_id: input.file_id,
        });
      }

      return {
        id: providerData.id,
        object: 'vector_store.file.deleted',
        deleted: providerData.deleted,
      };
    },
  });
}
