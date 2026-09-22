// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateDatabaseInputSchema = z.object({
  database_id: z.string().describe('The ID of the database to update. Example: "2b6ce298-3121-8079-a497-d3eca16d875c"'),
  title: z
    .array(
      z.object({
        text: z.object({
          content: z.string(),
        }),
      }),
    )
    .optional()
    .describe('New database title as rich text array.'),
  description: z.array(z.any()).optional().describe('Database description as rich text array.'),
  properties: z.record(z.string(), z.any()).optional().describe('Property schema updates.'),
});

export const updateDatabaseOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  title: z.array(z.any()),
  properties: z.record(z.string(), z.any()),
});

export function updateDatabaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_update_database',
    description: 'Modifies database title, description, or properties schema.',
    inputSchema: updateDatabaseInputSchema,
    outputSchema: updateDatabaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDatabaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/update-a-database
        endpoint: `v1/databases/${input.database_id}`,
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description && { description: input.description }),
          ...(input.properties && { properties: input.properties }),
        },
        retries: 3,
      };

      const response = await platformProxy.patch(config);
      const data = response.data;

      return {
        id: data.id,
        object: data.object,
        title: data.title,
        properties: data.properties,
      };
    },
  });
}
