// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getVectorStoreFileInputSchema = z.object({
  vector_store_id: z.string().describe('The ID of the vector store. Example: "vs_6a0cb67e028081918ccec0ba7278ffd0"'),
  file_id: z.string().describe('The ID of the file. Example: "file_abc123"'),
});

const ProviderVectorStoreFileSchema = z.object({
  id: z.string(),
  object: z.string(),
  vector_store_id: z.string(),
  status: z.string(),
  created_at: z.number(),
  usage_bytes: z.number(),
  chunking_strategy: z
    .object({
      type: z.string(),
      static: z
        .object({
          max_chunk_size_tokens: z.number(),
          chunk_overlap_tokens: z.number(),
        })
        .optional(),
    })
    .optional(),
  last_error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable()
    .optional(),
});

export const getVectorStoreFileOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  vector_store_id: z.string(),
  status: z.string(),
  created_at: z.number(),
  usage_bytes: z.number(),
  chunking_strategy: z
    .object({
      type: z.string(),
      static: z
        .object({
          max_chunk_size_tokens: z.number(),
          chunk_overlap_tokens: z.number(),
        })
        .optional(),
    })
    .optional(),
  last_error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export function getVectorStoreFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_get_vector_store_file',
    description: 'Retrieve a single file attached to a vector store.',
    inputSchema: getVectorStoreFileInputSchema,
    outputSchema: getVectorStoreFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getVectorStoreFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://platform.openai.com/docs/api-reference/vector-stores-files/get-vector-store-file
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}/files/${encodeURIComponent(input.file_id)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Vector store file not found',
          vector_store_id: input.vector_store_id,
          file_id: input.file_id,
        });
      }

      const providerFile = ProviderVectorStoreFileSchema.parse(response.data);

      return {
        id: providerFile.id,
        object: providerFile.object,
        vector_store_id: providerFile.vector_store_id,
        status: providerFile.status,
        created_at: providerFile.created_at,
        usage_bytes: providerFile.usage_bytes,
        ...(providerFile.chunking_strategy !== undefined && {
          chunking_strategy: providerFile.chunking_strategy,
        }),
        ...(providerFile.last_error != null && {
          last_error: {
            code: providerFile.last_error.code,
            message: providerFile.last_error.message,
          },
        }),
      };
    },
  });
}
