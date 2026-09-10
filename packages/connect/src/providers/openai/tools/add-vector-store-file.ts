// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addVectorStoreFileInputSchema = z.object({
  vector_store_id: z.string().describe('The ID of the vector store to attach the file to. Example: "vs_abc123"'),
  file_id: z
    .string()
    .describe('The ID of the file to attach. Must be a file that was previously uploaded. Example: "file-abc123"'),
  chunking_strategy: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('auto') }),
      z.object({
        type: z.literal('static'),
        static: z.object({
          max_chunk_size_tokens: z.number().describe('Maximum number of tokens per chunk'),
          chunk_overlap_tokens: z.number().describe('Number of tokens to overlap between chunks'),
        }),
      }),
    ])
    .optional()
    .describe('Chunking strategy for the file. Use "auto" or "static" with required static config.'),
  attributes: z.record(z.string(), z.any()).optional(),
});

const ProviderVectorStoreFileSchema = z.object({
  id: z.string(),
  vector_store_id: z.string(),
  status: z.union([z.literal('in_progress'), z.literal('completed'), z.literal('failed'), z.literal('cancelled')]),
  created_at: z.number(),
  usage_bytes: z.number().optional(),
});

export const addVectorStoreFileOutputSchema = z.object({
  id: z.string(),
  vector_store_id: z.string(),
  status: z.union([z.literal('in_progress'), z.literal('completed'), z.literal('failed'), z.literal('cancelled')]),
  created_at: z.number(),
  usage_bytes: z.number().optional(),
});

export function addVectorStoreFileTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_add_vector_store_file',
    description: 'Attach a file to a vector store for indexing',
    inputSchema: addVectorStoreFileInputSchema,
    outputSchema: addVectorStoreFileOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addVectorStoreFileOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://platform.openai.com/docs/api-reference/vector-stores-files/create
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}/files`,
        data: {
          file_id: input.file_id,
          ...(input.chunking_strategy !== undefined && { chunking_strategy: input.chunking_strategy }),
          ...(input.attributes !== undefined && { attributes: input.attributes }),
        },
        retries: 3,
      });

      const providerFile = ProviderVectorStoreFileSchema.parse(response.data);

      return {
        id: providerFile.id,
        vector_store_id: providerFile.vector_store_id,
        status: providerFile.status,
        created_at: providerFile.created_at,
        ...(providerFile.usage_bytes !== undefined && { usage_bytes: providerFile.usage_bytes }),
      };
    },
  });
}
