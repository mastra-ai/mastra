// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const retrieveDatabaseInputSchema = z.object({
  database_id: z
    .string()
    .describe('The ID of the database to retrieve. Example: "2b6ce298-3121-8079-a497-d3eca16d875c"'),
});

export const retrieveDatabaseOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  created_time: z.string(),
  last_edited_time: z.string(),
  title: z.array(z.any()),
  properties: z.record(z.string(), z.any()),
});

export function retrieveDatabaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_database',
    description: 'Gets database schema and column structure.',
    inputSchema: retrieveDatabaseInputSchema,
    outputSchema: retrieveDatabaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrieveDatabaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/retrieve-a-database
        endpoint: `v1/databases/${input.database_id}`,
        retries: 3,
      };

      const response = await platformProxy.get(config);
      const data = response.data;

      return {
        id: data.id,
        object: data.object,
        created_time: data.created_time,
        last_edited_time: data.last_edited_time,
        title: data.title,
        properties: data.properties,
      };
    },
  });
}
