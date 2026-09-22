// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getVectorStoreInputSchema = z.object({
  vector_store_id: z.string().describe('The ID of the vector store to retrieve. Example: "vs_abc123"'),
});

const FileCountsSchema = z.object({
  in_progress: z.number().optional(),
  completed: z.number().optional(),
  failed: z.number().optional(),
  cancelled: z.number().optional(),
  total: z.number().optional(),
});

const ProviderVectorStoreSchema = z.object({
  id: z.string(),
  object: z.string(),
  name: z.string().optional(),
  status: z.string(),
  file_counts: FileCountsSchema.optional(),
  usage_bytes: z.number().optional(),
  created_at: z.number().optional(),
  last_active_at: z.number().optional(),
  expires_at: z.number().nullish(),
  metadata: z.object({}).loose().nullish(),
});

export const getVectorStoreOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: z.string(),
  file_counts: FileCountsSchema.optional(),
  usage_bytes: z.number().optional(),
  created_at: z.number().optional(),
  last_active_at: z.number().optional(),
  expires_at: z.number().optional(),
  metadata: z.object({}).loose().optional(),
});

export function getVectorStoreTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_get_vector_store',
    description: 'Retrieve a single vector store from OpenAI',
    inputSchema: getVectorStoreInputSchema,
    outputSchema: getVectorStoreOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getVectorStoreOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://platform.openai.com/docs/api-reference/vector-stores/retrieve
      const response = await platformProxy.get({
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}`,
        retries: 3,
      });

      const providerData = ProviderVectorStoreSchema.parse(response.data);

      return {
        id: providerData.id,
        ...(providerData.name !== undefined && { name: providerData.name }),
        status: providerData.status,
        ...(providerData.file_counts !== undefined && { file_counts: providerData.file_counts }),
        ...(providerData.usage_bytes !== undefined && { usage_bytes: providerData.usage_bytes }),
        ...(providerData.created_at !== undefined && { created_at: providerData.created_at }),
        ...(providerData.last_active_at !== undefined && { last_active_at: providerData.last_active_at }),
        ...(providerData.expires_at !== undefined &&
          providerData.expires_at !== null && { expires_at: providerData.expires_at }),
        ...(providerData.metadata !== undefined &&
          providerData.metadata !== null && { metadata: providerData.metadata }),
      };
    },
  });
}
