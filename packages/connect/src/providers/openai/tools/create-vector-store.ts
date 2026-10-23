// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ExpiresAfterSchema = z.object({
  anchor: z.literal('last_active_at'),
  days: z.number().describe('Number of days after last activity when the vector store expires'),
});

const ChunkingStrategySchema = z.union([
  z.object({ type: z.literal('auto') }),
  z.object({
    type: z.literal('static'),
    static: z.object({
      max_chunk_size_tokens: z.number(),
      chunk_overlap_tokens: z.number(),
    }),
  }),
]);

const MetadataSchema = z.object({}).loose();

const FileIdSchema = z.string();

export const createVectorStoreInputSchema = z.object({
  name: z.string().optional().describe('A name for the vector store'),
  file_ids: z.array(FileIdSchema).optional().describe('File IDs to attach to the vector store immediately'),
  expires_after: ExpiresAfterSchema.optional().describe('Expiration policy for the vector store'),
  chunking_strategy: ChunkingStrategySchema.optional().describe('Chunking strategy for parsing files'),
  metadata: MetadataSchema.optional().describe('Metadata with up to 16 key-value pairs'),
});

const FileCountsSchema = z.object({
  in_progress: z.number(),
  completed: z.number(),
  failed: z.number(),
  cancelled: z.number(),
  total: z.number(),
});

const ProviderVectorStoreSchema = z.object({
  id: z.string(),
  object: z.literal('vector_store'),
  name: z.string().optional(),
  status: z.union([z.literal('completed'), z.literal('in_progress'), z.literal('expired')]),
  file_counts: FileCountsSchema,
  usage_bytes: z.number(),
  created_at: z.number(),
  last_active_at: z.number().optional(),
  expires_after: ExpiresAfterSchema.nullable().optional(),
  chunking_strategy: ChunkingStrategySchema.optional(),
  metadata: MetadataSchema.optional(),
});

export const createVectorStoreOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: z.union([z.literal('completed'), z.literal('in_progress'), z.literal('expired')]),
  file_counts: FileCountsSchema,
  usage_bytes: z.number(),
  created_at: z.number(),
  last_active_at: z.number().optional(),
  expires_after: ExpiresAfterSchema.optional(),
  chunking_strategy: ChunkingStrategySchema.optional(),
  metadata: MetadataSchema.optional(),
});

export function createVectorStoreTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_create_vector_store',
    description: 'Create a vector store in OpenAI',
    inputSchema: createVectorStoreInputSchema,
    outputSchema: createVectorStoreOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createVectorStoreOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {};

      if (input['name'] !== undefined) {
        body['name'] = input['name'];
      }

      if (input['file_ids'] !== undefined) {
        body['file_ids'] = input['file_ids'];
      }

      if (input['expires_after'] !== undefined) {
        body['expires_after'] = input['expires_after'];
      }

      if (input['chunking_strategy'] !== undefined) {
        body['chunking_strategy'] = input['chunking_strategy'];
      }

      if (input['metadata'] !== undefined) {
        body['metadata'] = input['metadata'];
      }

      // https://platform.openai.com/docs/api-reference/vector-stores/create
      const response = await platformProxy.post({
        endpoint: '/v1/vector_stores',
        data: body,
        retries: 3,
      });

      const vectorStore = ProviderVectorStoreSchema.parse(response.data);

      return {
        id: vectorStore.id,
        ...(vectorStore.name !== undefined && { name: vectorStore.name }),
        status: vectorStore.status,
        file_counts: vectorStore.file_counts,
        usage_bytes: vectorStore.usage_bytes,
        created_at: vectorStore.created_at,
        ...(vectorStore.last_active_at !== undefined && { last_active_at: vectorStore.last_active_at }),
        ...(vectorStore.expires_after !== undefined &&
          vectorStore.expires_after !== null && { expires_after: vectorStore.expires_after }),
        ...(vectorStore.chunking_strategy !== undefined && { chunking_strategy: vectorStore.chunking_strategy }),
        ...(vectorStore.metadata !== undefined && { metadata: vectorStore.metadata }),
      };
    },
  });
}
