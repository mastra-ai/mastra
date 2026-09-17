// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchInputSchema = z.object({
  query: z.string().optional().describe('Search query string to filter results by title.'),
  filter: z
    .object({
      property: z.literal('object'),
      value: z.enum(['page', 'data_source']),
    })
    .describe('Filter to search only pages or only data_sources.')
    .optional(),
  sort: z
    .object({
      timestamp: z.enum(['last_edited_time', 'created_time']),
      direction: z.enum(['ascending', 'descending']),
    })
    .describe('Sort order for results.')
    .optional(),
  start_cursor: z.string().optional().describe('Pagination cursor for the next page of results.'),
  page_size: z.number().describe('Number of results per page (max 100).').min(1).max(100).optional(),
});

const ProviderResponseSchema = z.object({
  object: z.literal('list'),
  results: z.array(z.unknown()),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  type: z.string().optional(),
  page_or_data_source: z.object({}).optional(),
});

export const searchOutputSchema = z.object({
  results: z.array(z.unknown()),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
});

export function searchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_search',
    description: 'Search pages, data sources, and other searchable Notion objects.',
    inputSchema: searchInputSchema,
    outputSchema: searchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {};

      if (input['query'] !== undefined) {
        requestBody['query'] = input['query'];
      }

      if (input['filter'] !== undefined) {
        requestBody['filter'] = input['filter'];
      }

      if (input['sort'] !== undefined) {
        requestBody['sort'] = input['sort'];
      }

      if (input['start_cursor'] !== undefined) {
        requestBody['start_cursor'] = input['start_cursor'];
      }

      if (input['page_size'] !== undefined) {
        requestBody['page_size'] = input['page_size'];
      }

      const response = await platformProxy.post({
        // https://developers.notion.com/reference/post-search
        endpoint: '/v1/search',
        data: requestBody,
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        results: parsed.results,
        ...(parsed.next_cursor !== null && { next_cursor: parsed.next_cursor }),
        has_more: parsed.has_more,
      };
    },
  });
}
