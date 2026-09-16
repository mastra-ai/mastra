// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createDataSourceInputSchema = z.object({
  databaseId: z
    .string()
    .describe(
      'The ID of the parent database (with or without dashes). Example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"',
    ),
  title: z.string().optional().describe('Title of the data source as it appears in Notion.'),
  icon: z
    .object({
      type: z.literal('emoji'),
      emoji: z.string(),
    })
    .optional()
    .describe('Icon for the data source.'),
  properties: z
    .object({})
    .passthrough()
    .describe(
      'Property schema of the data source. Example: { "Name": { "title": {} }, "Status": { "select": { "options": [{ "name": "To Do", "color": "red" }] } } }',
    ),
});

const DataSourceResponseSchema = z.object({
  object: z.literal('data_source'),
  id: z.string(),
  title: z
    .array(
      z.object({
        type: z.string(),
        text: z
          .object({
            content: z.string(),
          })
          .optional(),
      }),
    )
    .optional(),
  parent: z.object({
    type: z.string(),
    database_id: z.string(),
  }),
  properties: z.object({}).passthrough(),
  url: z.string().optional(),
});

export const createDataSourceOutputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  databaseId: z.string(),
  url: z.string().optional(),
});

export function createDataSourceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_create_data_source',
    description: 'Create a Notion data source in its supported parent container.',
    inputSchema: createDataSourceInputSchema,
    outputSchema: createDataSourceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDataSourceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const titleContent = input.title || 'New Data Source';

      const requestBody: Record<string, unknown> = {
        parent: {
          database_id: input.databaseId,
        },
        title: [
          {
            type: 'text',
            text: {
              content: titleContent,
            },
          },
        ],
        properties: input.properties,
      };

      if (input.icon) {
        requestBody['icon'] = input.icon;
      }

      // https://developers.notion.com/reference/create-a-data-source
      const response = await platformProxy.post({
        endpoint: '/v1/data_sources',
        headers: {
          'Notion-Version': '2026-03-11',
        },
        data: requestBody,
        retries: 3,
      });

      const dataSource = DataSourceResponseSchema.parse(response.data);

      const titleText = dataSource.title?.[0]?.text?.content || '';

      return {
        id: dataSource.id,
        title: titleText,
        databaseId: dataSource.parent.database_id,
        url: dataSource.url,
      };
    },
  });
}
