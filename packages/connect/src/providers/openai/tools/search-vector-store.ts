// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchVectorStoreInputSchema = z.object({
  vector_store_id: z.string(),
  query: z.string(),
  max_num_results: z.number().int().min(1).max(50).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  ranking_options: z
    .object({
      ranker: z.string().optional(),
      score_threshold: z.number().optional(),
    })
    .optional(),
  rewrite_query: z.boolean().optional(),
  next_page: z.string().optional(),
});

const ContentItemSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
});

const SearchResultSchema = z.object({
  file_id: z.string(),
  filename: z.string().optional(),
  score: z.number(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  content: z.array(ContentItemSchema).optional(),
});

export const searchVectorStoreOutputSchema = z.object({
  object: z.string(),
  search_query: z.array(z.string()),
  data: z.array(SearchResultSchema),
  has_more: z.boolean(),
  next_page: z.string().nullable().optional(),
});

export function searchVectorStoreTool(proxy: PlatformProxy) {
  return createTool({
    id: 'openai_search_vector_store',
    description: 'Search a vector store for semantically matching content chunks',
    inputSchema: searchVectorStoreInputSchema,
    outputSchema: searchVectorStoreOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchVectorStoreOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {
        query: input.query,
      };

      if (input['max_num_results'] !== undefined) {
        body['max_num_results'] = input['max_num_results'];
      }
      if (input['filters'] !== undefined) {
        body['filters'] = input['filters'];
      }
      if (input['ranking_options'] !== undefined) {
        body['ranking_options'] = input['ranking_options'];
      }
      if (input['rewrite_query'] !== undefined) {
        body['rewrite_query'] = input['rewrite_query'];
      }
      if (input['next_page'] !== undefined) {
        body['next_page'] = input['next_page'];
      }

      // https://platform.openai.com/docs/api-reference/vector-stores/search
      const response = await platformProxy.post({
        endpoint: `/v1/vector_stores/${encodeURIComponent(input.vector_store_id)}/search`,
        data: body,
        retries: 3,
      });

      const result = searchVectorStoreOutputSchema.safeParse(response.data);
      if (!result.success) {
        throw new platformProxy.ActionError({
          message: 'Invalid response from OpenAI API',
          errors: result.error.issues,
        });
      }

      return result.data;
    },
  });
}
