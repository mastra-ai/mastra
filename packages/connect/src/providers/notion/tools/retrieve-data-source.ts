// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const retrieveDataSourceInputSchema = z.object({
  data_source_id: z
    .string()
    .describe('The ID of the Notion data source to retrieve. Example: "d9824bdc-8445-4327-be8b-5b47500af6ce"'),
});

const DataSourceSchema = z.object({
  object: z.literal('data_source'),
  id: z.string(),
  title: z.array(z.unknown()).optional(),
  description: z.array(z.unknown()).optional(),
  parent: z.unknown().optional(),
  database_parent: z.unknown().optional(),
  is_inline: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: z.unknown().optional(),
  last_edited_by: z.unknown().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  icon: z.unknown().optional(),
  cover: z.unknown().optional(),
  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});

export const retrieveDataSourceOutputSchema = z.object({
  object: z.literal('data_source'),
  id: z.string(),
  title: z.array(z.unknown()).optional(),
  description: z.array(z.unknown()).optional(),
  parent: z.unknown().optional(),
  database_parent: z.unknown().optional(),
  is_inline: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: z.unknown().optional(),
  last_edited_by: z.unknown().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  icon: z.unknown().optional(),
  cover: z.unknown().optional(),
  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});

export function retrieveDataSourceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_data_source',
    description: 'Retrieve a Notion data source definition and schema.',
    inputSchema: retrieveDataSourceInputSchema,
    outputSchema: retrieveDataSourceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrieveDataSourceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.notion.com/reference/retrieve-a-data-source
        endpoint: `/v1/data_sources/${encodeURIComponent(input.data_source_id)}`,
        headers: {
          'Notion-Version': '2025-09-03',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Data source not found',
          data_source_id: input.data_source_id,
        });
      }

      const dataSource = DataSourceSchema.parse(response.data);

      return {
        object: dataSource.object,
        id: dataSource.id,
        ...(dataSource.title !== undefined && { title: dataSource.title }),
        ...(dataSource.description !== undefined && { description: dataSource.description }),
        ...(dataSource.parent !== undefined && { parent: dataSource.parent }),
        ...(dataSource.database_parent !== undefined && { database_parent: dataSource.database_parent }),
        ...(dataSource.is_inline !== undefined && { is_inline: dataSource.is_inline }),
        ...(dataSource.in_trash !== undefined && { in_trash: dataSource.in_trash }),
        ...(dataSource.created_time !== undefined && { created_time: dataSource.created_time }),
        ...(dataSource.last_edited_time !== undefined && { last_edited_time: dataSource.last_edited_time }),
        ...(dataSource.created_by !== undefined && { created_by: dataSource.created_by }),
        ...(dataSource.last_edited_by !== undefined && { last_edited_by: dataSource.last_edited_by }),
        ...(dataSource.properties !== undefined && { properties: dataSource.properties }),
        ...(dataSource.icon !== undefined && { icon: dataSource.icon }),
        ...(dataSource.cover !== undefined && { cover: dataSource.cover }),
        ...(dataSource.url !== undefined && { url: dataSource.url }),
        ...(dataSource.public_url !== undefined && { public_url: dataSource.public_url }),
      };
    },
  });
}
