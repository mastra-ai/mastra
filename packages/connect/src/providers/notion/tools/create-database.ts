// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createDatabaseInputSchema = z.object({
  parent: z
    .object({
      page_id: z.string().describe('Parent page ID. Example: "2b6ce298-3121-80ae-bfe1-f8984b993639"'),
    })
    .describe('Parent page where database will be created.'),
  title: z
    .array(
      z.object({
        text: z.object({
          content: z.string(),
        }),
      }),
    )
    .describe('Database title as rich text array.'),
  properties: z
    .record(z.string(), z.any())
    .describe('Database property schema. Example: {"Name":{"title":{}},"Description":{"rich_text":{}}}'),
});

export const createDatabaseOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  created_time: z.string(),
  title: z.array(z.any()),
  properties: z.record(z.string(), z.any()),
});

export function createDatabaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_create_database',
    description: 'Creates a new database as subpage with defined properties schema.',
    inputSchema: createDatabaseInputSchema,
    outputSchema: createDatabaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDatabaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/create-a-database
        endpoint: 'v1/databases',
        data: {
          parent: input.parent,
          title: input.title,
          properties: input.properties,
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);
      const data = response.data;

      return {
        id: data.id,
        object: data.object,
        created_time: data.created_time,
        title: data.title,
        properties: data.properties,
      };
    },
  });
}
