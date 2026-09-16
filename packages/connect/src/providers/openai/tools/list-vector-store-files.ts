// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listVectorStoreFilesInputSchema = z.object({
  vector_store_id: z.string().describe('The ID of the vector store to list files from. Example: "vs_abc123"'),
  after: z.string().optional().describe('Cursor for pagination. The ID of the file to start after.'),
  limit: z.number().min(1).max(100).optional().describe('Number of files to return (1-100, default 20).'),
  order: z.enum(['asc', 'desc']).optional().describe('Sort order by created_at.'),
  filter: z.enum(['in_progress', 'completed', 'failed', 'cancelled']).optional().describe('Filter by file status.'),
});

const VectorStoreFileSchema = z.object({
  id: z.string(),
  object: z.string(),
  vector_store_id: z.string(),
  status: z.enum(['in_progress', 'completed', 'failed', 'cancelled']),
  created_at: z.number(),
  usage_bytes: z.number(),
});

export const listVectorStoreFilesOutputSchema = z.object({
  data: z.array(VectorStoreFileSchema),
  has_more: z.boolean(),
  first_id: z.string().optional(),
  last_id: z.string().optional(),
});

export function listVectorStoreFilesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_list_vector_store_files',
    description: 'List files attached to a vector store',
    inputSchema: listVectorStoreFilesInputSchema,
    outputSchema: listVectorStoreFilesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listVectorStoreFilesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};

      if (input.after !== undefined) {
        params['after'] = input.after;
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.order !== undefined) {
        params['order'] = input.order;
      }
      if (input.filter !== undefined) {
        params['filter'] = input.filter;
      }

      // https://platform.openai.com/docs/api-reference/vector-stores-files/listFiles
      const response = await platformProxy.get({
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}/files`,
        params,
        retries: 3,
      });

      const rawData = response.data;

      return {
        data: rawData.data || [],
        has_more: rawData.has_more || false,
        ...(rawData.first_id != null && { first_id: rawData.first_id }),
        ...(rawData.last_id != null && { last_id: rawData.last_id }),
      };
    },
  });
}
