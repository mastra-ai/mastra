// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const ContentUpdateSchema = z.object({
  old_str: z
    .string()
    .describe('Text to find in the page content. Must match exactly one location unless replace_all_matches is true.'),
  new_str: z.string().describe('Replacement text.'),
  replace_all_matches: z
    .boolean()
    .optional()
    .describe('If true, replace all occurrences of old_str. Defaults to false.'),
});

export const updatePageMarkdownInputSchema = z.object({
  page_id: z.string().describe('Notion page ID. Example: "b55c9c91-384d-452b-81db-d1ef79372b75"'),
  type: z
    .enum(['update_content', 'replace_content', 'insert_content', 'replace_content_range'])
    .describe('Command type for the update operation.'),
  update_content: z
    .object({
      content_updates: z.array(ContentUpdateSchema).describe('Array of search-and-replace operations.'),
      allow_deleting_content: z
        .boolean()
        .optional()
        .describe('Set to true to allow the operation to delete child pages or databases.'),
    })
    .optional(),
  replace_content: z
    .object({
      new_str: z.string().describe('The new enhanced markdown content to replace the entire page content.'),
      allow_deleting_content: z
        .boolean()
        .optional()
        .describe('Set to true to allow the operation to delete child pages or databases.'),
    })
    .optional(),
  insert_content: z
    .object({
      content: z.string().describe('Markdown content to insert.'),
      after: z
        .string()
        .optional()
        .describe(
          'Ellipsis-based selection format to insert after a specific location. Example: "# Heading...end of section"',
        ),
    })
    .optional(),
  replace_content_range: z
    .object({
      content: z.string().describe('Markdown content to insert at the replaced range.'),
      range: z
        .string()
        .describe('Ellipsis-based selection format defining the range to replace. Example: "start text...end text"'),
      allow_deleting_content: z
        .boolean()
        .optional()
        .describe('Set to true to allow the operation to delete child pages or databases.'),
    })
    .optional(),
});

const PageMarkdownSchema = z.object({
  object: z.literal('page_markdown'),
  id: z.string(),
  markdown: z.string(),
  truncated: z.boolean(),
  unknown_block_ids: z.array(z.string()),
});

export const updatePageMarkdownOutputSchema = z.object({
  id: z.string(),
  markdown: z.string(),
  truncated: z.boolean(),
  unknown_block_ids: z.array(z.string()).optional(),
});

export function updatePageMarkdownTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_update_page_markdown',
    description:
      'Update page content using markdown commands. Supports targeted edits, full replacement, insertion, and range replacement.',
    inputSchema: updatePageMarkdownInputSchema,
    outputSchema: updatePageMarkdownOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePageMarkdownOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const commandMap: Record<string, unknown> = {
        type: input.type,
      };

      if (input.type === 'update_content') {
        if (!input['update_content']) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'update_content payload is required when type is update_content.',
          });
        }
        commandMap['update_content'] = input['update_content'];
      } else if (input.type === 'replace_content') {
        if (!input['replace_content']) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'replace_content payload is required when type is replace_content.',
          });
        }
        commandMap['replace_content'] = input['replace_content'];
      } else if (input.type === 'insert_content') {
        if (!input['insert_content']) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'insert_content payload is required when type is insert_content.',
          });
        }
        commandMap['insert_content'] = input['insert_content'];
      } else if (input.type === 'replace_content_range') {
        if (!input['replace_content_range']) {
          throw new platformProxy.ActionError({
            type: 'invalid_input',
            message: 'replace_content_range payload is required when type is replace_content_range.',
          });
        }
        commandMap['replace_content_range'] = input['replace_content_range'];
      }

      // https://developers.notion.com/reference/update-page-markdown
      const response = await platformProxy.patch({
        endpoint: `/v1/pages/${encodeURIComponent(input.page_id)}/markdown`,
        data: commandMap,
        headers: {
          'Notion-Version': '2025-09-03',
        },
        retries: 3,
      });

      const pageMarkdown = PageMarkdownSchema.parse(response.data);

      return {
        id: pageMarkdown.id,
        markdown: pageMarkdown.markdown,
        truncated: pageMarkdown.truncated,
        ...(pageMarkdown.unknown_block_ids.length > 0 && { unknown_block_ids: pageMarkdown.unknown_block_ids }),
      };
    },
  });
}
