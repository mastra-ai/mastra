// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ExpiresAfterSchema = z.object({
  anchor: z.literal('last_active_at'),
  days: z.number().int().min(1),
});

export const updateVectorStoreInputSchema = z.object({
  vector_store_id: z.string(),
  name: z.string().optional(),
  expires_after: ExpiresAfterSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ProviderFileCountsSchema = z.object({
  total: z.number().int(),
  in_progress: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
  cancelled: z.number().int(),
});

const ProviderVectorStoreSchema = z.object({
  id: z.string(),
  object: z.literal('vector_store'),
  created_at: z.number().int(),
  name: z.string(),
  bytes: z.number().int().optional(),
  file_counts: ProviderFileCountsSchema,
  expires_after: ExpiresAfterSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateVectorStoreOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  created_at: z.number().int(),
  name: z.string(),
  bytes: z.number().int().optional(),
  file_counts: ProviderFileCountsSchema,
  expires_after: ExpiresAfterSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export function updateVectorStoreTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_update_vector_store',
    description: 'Update a vector store in OpenAI',
    inputSchema: updateVectorStoreInputSchema,
    outputSchema: updateVectorStoreOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateVectorStoreOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestData: {
        name?: string;
        expires_after?: z.infer<typeof ExpiresAfterSchema> | null;
        metadata?: Record<string, unknown>;
      } = {};

      if (input.name !== undefined) {
        requestData.name = input.name;
      }

      if (input.expires_after !== undefined) {
        requestData.expires_after = input.expires_after;
      }

      if (input.metadata !== undefined) {
        requestData.metadata = input.metadata;
      }

      // https://platform.openai.com/docs/api-reference/vector-stores/modify
      const response = await platformProxy.post({
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}`,
        data: requestData,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Vector store not found',
          vector_store_id: input.vector_store_id,
        });
      }

      const providerVectorStore = ProviderVectorStoreSchema.parse(response.data);

      return {
        id: providerVectorStore.id,
        object: providerVectorStore.object,
        created_at: providerVectorStore.created_at,
        name: providerVectorStore.name,
        bytes: providerVectorStore.bytes,
        file_counts: providerVectorStore.file_counts,
        ...(providerVectorStore.expires_after !== undefined && { expires_after: providerVectorStore.expires_after }),
        ...(providerVectorStore.metadata !== undefined && { metadata: providerVectorStore.metadata }),
      };
    },
  });
}
