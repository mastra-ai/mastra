// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ParentSchema = z.object({
  page_id: z.string().optional(),
  database_id: z.string().optional(),
  data_source_id: z.string().optional(),
  workspace: z.boolean().optional(),
});

const IconSchema = z.object({
  type: z.enum(['emoji', 'external', 'file', 'custom_emoji']),
  emoji: z.string().optional(),
  external: z.object({ url: z.string() }).optional(),
  file: z.object({}).optional(),
  custom_emoji: z.string().optional(),
});

const CoverSchema = z.object({
  type: z.enum(['external', 'file']),
  external: z.object({ url: z.string() }).optional(),
  file: z.object({}).optional(),
});

const BlockSchema = z.object({
  type: z.enum([
    'paragraph',
    'heading_1',
    'heading_2',
    'heading_3',
    'bulleted_list_item',
    'numbered_list_item',
    'to_do',
  ]),
  text: z.string(),
  checked: z.boolean().optional(),
});

const TemplateSchema = z.object({
  type: z.enum(['none', 'default', 'template_id']),
  template_id: z.string().optional(),
  timezone: z.string().optional(),
});

export const createPageInputSchema = z.object({
  parent: ParentSchema,
  title: z.string().optional(),
  properties: z.any().optional(),
  icon: IconSchema.optional(),
  cover: CoverSchema.optional(),
  children: z.array(BlockSchema).optional(),
  template: TemplateSchema.optional(),
  markdown: z.string().optional(),
});

const ProviderPageSchema = z.object({
  id: z.string(),
  object: z.literal('page'),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: z.object({ id: z.string() }).optional(),
  last_edited_by: z.object({ id: z.string() }).optional(),
  cover: z.unknown().optional(),
  icon: z.unknown().optional(),
  parent: z.unknown().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  properties: z.any().optional(),
  url: z.string().optional(),
  public_url: z.string().nullable().optional(),
});

export const createPageOutputSchema = z.object({
  id: z.string(),
  object: z.literal('page').optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  url: z.string().optional(),
  public_url: z.string().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
  parent: z.unknown().optional(),
  icon: z.unknown().optional(),
  cover: z.unknown().optional(),
  properties: z.any().optional(),
});

export function createPageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_create_page',
    description: 'Create a new Notion page with properties and optional children.',
    inputSchema: createPageInputSchema,
    outputSchema: createPageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createPageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Validate that exactly one parent type is provided
      const parentTypes = [
        input.parent.page_id,
        input.parent.database_id,
        input.parent.data_source_id,
        input.parent.workspace,
      ].filter(Boolean);

      if (parentTypes.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Exactly one parent type must be provided: page_id, database_id, data_source_id, or workspace=true.',
        });
      }

      if (parentTypes.length > 1) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Only one parent type can be provided: page_id, database_id, data_source_id, or workspace=true.',
        });
      }

      // Build parent object
      let parent: Record<string, unknown> = {};
      if (input.parent.page_id) {
        parent = { type: 'page_id', page_id: input.parent.page_id };
      } else if (input.parent.database_id) {
        parent = { type: 'database_id', database_id: input.parent.database_id };
      } else if (input.parent.data_source_id) {
        parent = { type: 'data_source_id', data_source_id: input.parent.data_source_id };
      } else if (input.parent.workspace) {
        parent = { type: 'workspace', workspace: true };
      }

      // Build properties object
      const properties: Record<string, unknown> = input.properties ? { ...input.properties } : {};

      // Add title if provided
      if (input.title !== undefined && input.title !== null) {
        // For database/data_source parents, title might have a different key
        // For page parents, use the title property
        const titleKey = 'title';
        properties[titleKey] = {
          title: [
            {
              text: {
                content: input.title,
              },
            },
          ],
        };
      }

      // Build request body
      const body: Record<string, unknown> = {
        parent,
        properties,
      };

      // Add icon if provided
      if (input.icon) {
        body['icon'] = input.icon;
      }

      // Add cover if provided
      if (input.cover) {
        body['cover'] = input.cover;
      }

      // Add children if provided (convert to Notion block format)
      if (input.children && input.children.length > 0) {
        const children = input.children.map(child => {
          const block: Record<string, unknown> = {
            object: 'block',
            type: child.type,
          };

          // Handle different block types
          if (child.type === 'to_do') {
            block[child.type] = {
              rich_text: [
                {
                  text: {
                    content: child.text,
                  },
                },
              ],
              checked: child.checked ?? false,
            };
          } else if (child.type.startsWith('heading_')) {
            block[child.type] = {
              rich_text: [
                {
                  text: {
                    content: child.text,
                  },
                },
              ],
            };
          } else {
            block[child.type] = {
              rich_text: [
                {
                  text: {
                    content: child.text,
                  },
                },
              ],
            };
          }

          return block;
        });
        body['children'] = children;
      }

      // Add markdown if provided
      if (input.markdown) {
        if (input.children && input.children.length > 0) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'markdown cannot be provided together with children.',
          });
        }
        body['markdown'] = input.markdown;
      }

      // Add template if provided
      if (input.template) {
        if (input.children && input.children.length > 0 && input.template.type !== 'none') {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'children cannot be provided when template.type is default or template_id.',
          });
        }
        body['template'] = input.template;
      }

      // https://developers.notion.com/reference/post-page
      const response = await platformProxy.post({
        endpoint: '/v1/pages',
        data: body,
        retries: 3,
      });

      const page = ProviderPageSchema.parse(response.data);

      return {
        id: page.id,
        object: page.object,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        url: page.url,
        public_url: page.public_url ?? undefined,
        archived: page.archived,
        in_trash: page.in_trash,
        parent: page.parent,
        icon: page.icon,
        cover: page.cover,
        properties: page.properties,
      };
    },
  });
}
