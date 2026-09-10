// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const TextContentSchema = z.object({
  content: z.string(),
  link: z
    .object({
      url: z.string(),
    })
    .optional()
    .nullable(),
});

const RichTextItemSchema = z.object({
  type: z.literal('text'),
  text: TextContentSchema,
});

const IconSchema = z.union([
  z.object({
    type: z.literal('emoji'),
    emoji: z.string(),
  }),
  z.object({
    type: z.literal('external'),
    external: z.object({
      url: z.string(),
    }),
  }),
  z.object({
    type: z.literal('file'),
    file: z.object({
      url: z.string(),
      expiry_time: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('custom_emoji'),
    custom_emoji: z.object({
      id: z.string(),
      name: z.string().optional(),
      url: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('icon'),
    icon: z.object({
      name: z.string(),
      color: z
        .enum(['gray', 'lightgray', 'brown', 'yellow', 'orange', 'green', 'blue', 'purple', 'pink', 'red'])
        .optional(),
    }),
  }),
]);

const ParentSchema = z.object({
  type: z.literal('database_id'),
  database_id: z.string(),
});

const PropertyUpdateSchema = z.record(
  z.string(),
  z.union([
    // Property configuration object
    z.object({
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      type: z.string().optional(),
    }),
    // Null to remove a property
    z.null(),
  ]),
);

export const updateDataSourceInputSchema = z.object({
  dataSourceId: z
    .string()
    .describe('The ID of the data source to update. Example: "d9824bdc-8445-4327-be8b-5b47500af6ce"'),
  title: z.array(RichTextItemSchema).max(100).optional().describe('Title of the data source as it appears in Notion.'),
  description: z
    .array(RichTextItemSchema)
    .max(100)
    .optional()
    .describe('Description of the data source as it appears in Notion.'),
  properties: PropertyUpdateSchema.optional().describe(
    'The property schema updates for the data source. Properties set to null will be removed.',
  ),
  inTrash: z.boolean().optional().describe('Whether to move the data source to or from the trash.'),
  parent: ParentSchema.optional().describe('The parent of the data source, when moving it to a different database.'),
  icon: IconSchema.nullable().optional().describe('New icon for the data source. Set to null to remove the icon.'),
});

const PartialUserSchema = z.object({
  object: z.literal('user'),
  id: z.string(),
});

const PropertyConfigSchema = z.object({}).passthrough();

const RichTextItemOutputSchema = z.object({
  type: z.string(),
  text: z.object({
    content: z.string(),
    link: z
      .object({
        url: z.string(),
      })
      .optional()
      .nullable(),
  }),
  annotations: z.object({}).passthrough().optional(),
  plain_text: z.string().optional(),
  href: z.string().optional().nullable(),
});

export const updateDataSourceOutputSchema = z.object({
  object: z.literal('data_source'),
  id: z.string().describe('The ID of the data source.'),
  title: z.array(RichTextItemOutputSchema).optional(),
  description: z.array(RichTextItemOutputSchema).optional(),
  parent: z
    .object({
      type: z.literal('database_id'),
      database_id: z.string(),
    })
    .optional(),
  database_parent: z
    .object({
      type: z.string(),
      page_id: z.string().optional(),
      workspace: z.boolean().optional(),
      block_id: z.string().optional(),
      database_id: z.string().optional(),
    })
    .optional(),
  is_inline: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  created_time: z.string().optional().describe('ISO 8601 timestamp when the data source was created.'),
  last_edited_time: z.string().optional().describe('ISO 8601 timestamp when the data source was last edited.'),
  created_by: PartialUserSchema.optional(),
  last_edited_by: PartialUserSchema.optional(),
  properties: z.record(z.string(), PropertyConfigSchema).optional(),
  icon: z.unknown().optional(),
  cover: z.unknown().optional().nullable(),
  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});

export function updateDataSourceTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_update_data_source',
    description: "Update a Notion data source's title, description, or schema properties.",
    inputSchema: updateDataSourceInputSchema,
    outputSchema: updateDataSourceOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDataSourceOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build request body, omitting undefined values
      const requestBody: Record<string, unknown> = {};

      if (input.title !== undefined) {
        requestBody['title'] = input.title;
      }

      if (input.description !== undefined) {
        requestBody['description'] = input.description;
      }

      if (input.properties !== undefined) {
        requestBody['properties'] = input.properties;
      }

      if (input.inTrash !== undefined) {
        requestBody['in_trash'] = input.inTrash;
      }

      if (input.parent !== undefined) {
        requestBody['parent'] = input.parent;
      }

      if (input.icon !== undefined) {
        requestBody['icon'] = input.icon;
      }

      // https://developers.notion.com/reference/update-a-data-source
      const response = await platformProxy.patch({
        endpoint: `/v1/data_sources/${encodeURIComponent(input.dataSourceId)}`,
        data: requestBody,
        retries: 3,
        headers: {
          'Notion-Version': '2025-09-03',
        },
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Data source not found or update failed',
          data_source_id: input.dataSourceId,
        });
      }

      // Parse and validate the response data
      const rawData = response.data;
      if (typeof rawData !== 'object' || rawData === null) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Notion API',
          data_source_id: input.dataSourceId,
        });
      }

      // Type guard to check if value is a record
      const isRecord = (value: unknown): value is Record<string, unknown> => {
        return typeof value === 'object' && value !== null;
      };

      // Helper function to safely get values from the response
      const getValue = (obj: unknown, key: string): unknown => {
        if (isRecord(obj) && key in obj) {
          return obj[key];
        }
        return undefined;
      };

      // Build the result object with proper type checking
      const rawId = getValue(rawData, 'id');
      if (typeof rawId !== 'string') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Data source response missing valid id field',
          data_source_id: input.dataSourceId,
        });
      }

      const result: Record<string, unknown> = {
        object: 'data_source',
        id: rawId,
      };

      const title = getValue(rawData, 'title');
      if (title !== undefined) {
        result['title'] = title;
      }

      const description = getValue(rawData, 'description');
      if (description !== undefined) {
        result['description'] = description;
      }

      const parent = getValue(rawData, 'parent');
      if (parent !== undefined) {
        result['parent'] = parent;
      }

      const databaseParent = getValue(rawData, 'database_parent');
      if (databaseParent !== undefined) {
        result['database_parent'] = databaseParent;
      }

      const isInline = getValue(rawData, 'is_inline');
      if (isInline !== undefined) {
        result['is_inline'] = Boolean(isInline);
      }

      const inTrash = getValue(rawData, 'in_trash');
      if (inTrash !== undefined) {
        result['in_trash'] = Boolean(inTrash);
      }

      const createdTime = getValue(rawData, 'created_time');
      if (createdTime !== undefined) {
        result['created_time'] = String(createdTime);
      }

      const lastEditedTime = getValue(rawData, 'last_edited_time');
      if (lastEditedTime !== undefined) {
        result['last_edited_time'] = String(lastEditedTime);
      }

      const createdBy = getValue(rawData, 'created_by');
      if (createdBy !== undefined) {
        result['created_by'] = createdBy;
      }

      const lastEditedBy = getValue(rawData, 'last_edited_by');
      if (lastEditedBy !== undefined) {
        result['last_edited_by'] = lastEditedBy;
      }

      const properties = getValue(rawData, 'properties');
      if (properties !== undefined) {
        result['properties'] = properties;
      }

      const icon = getValue(rawData, 'icon');
      if (icon !== undefined) {
        result['icon'] = icon;
      }

      const cover = getValue(rawData, 'cover');
      if (cover !== undefined) {
        result['cover'] = cover;
      }

      const url = getValue(rawData, 'url');
      if (url !== undefined) {
        result['url'] = String(url);
      }

      const publicUrl = getValue(rawData, 'public_url');
      if (publicUrl !== undefined) {
        result['public_url'] = publicUrl;
      }

      // Validate the result with Zod to ensure it matches the expected output
      const validatedResult = updateDataSourceOutputSchema.parse(result);
      return validatedResult;
    },
  });
}
