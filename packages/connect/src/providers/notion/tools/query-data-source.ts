// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const queryDataSourceInputSchema = z.object({
  data_source_id: z.string(),
  filter: z.optional(z.record(z.string(), z.unknown())),
  sorts: z.optional(z.array(z.record(z.string(), z.unknown()))),
  start_cursor: z.optional(z.string()),
  page_size: z.optional(z.number()),
  in_trash: z.optional(z.boolean()),
});

export const queryDataSourceOutputSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())),
  next_cursor: z.optional(z.string()),
  has_more: z.boolean(),
  request_status: z.optional(z.record(z.string(), z.unknown())),
});

export function queryDataSourceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_query_data_source',
    description: 'Query entries in a Notion data source using filters and sorts.',
    inputSchema: queryDataSourceInputSchema,
    outputSchema: queryDataSourceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof queryDataSourceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {};

      if (input['filter'] !== undefined) {
        requestBody['filter'] = input['filter'];
      }
      if (input['sorts'] !== undefined) {
        requestBody['sorts'] = input['sorts'];
      }
      if (input['start_cursor'] !== undefined) {
        requestBody['start_cursor'] = input['start_cursor'];
      }
      if (input['page_size'] !== undefined) {
        requestBody['page_size'] = input['page_size'];
      }
      if (input['in_trash'] !== undefined) {
        requestBody['in_trash'] = input['in_trash'];
      }
      // https://developers.notion.com/reference/query-a-database
      const response = await platformProxy.post({
        endpoint: `/v1/databases/${encodeURIComponent(input.data_source_id)}/query`,
        data: requestBody,
        retries: 3,
        headers: {
          'Notion-Version': '2022-06-28',
        },
      });

      const ResponseSchema = z.object({
        results: z.array(z.record(z.string(), z.unknown())),
        next_cursor: z.union([z.string(), z.null()]),
        has_more: z.boolean(),
        request_status: z.optional(z.record(z.string(), z.unknown())),
      });

      const parsed = ResponseSchema.parse(response.data);

      return {
        results: parsed.results,
        ...(parsed.next_cursor !== null && { next_cursor: parsed.next_cursor }),
        has_more: parsed.has_more,
        ...(parsed.request_status !== undefined && { request_status: parsed.request_status }),
      };
    },
  });
}
