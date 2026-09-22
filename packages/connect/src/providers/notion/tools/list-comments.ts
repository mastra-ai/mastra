// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCommentsInputSchema = z.object({
  block_id: z
    .string()
    .describe(
      'The ID of the block (page or block) to retrieve comments for. Example: "5c6a28216bb14a7eb6e1c50111515c3d"',
    ),
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
  page_size: z.number().min(1).max(100).optional().describe('Number of comments to return per page. Maximum: 100.'),
});

const RichTextSchema = z.object({
  type: z.string().optional(),
  text: z
    .object({
      content: z.string(),
      link: z
        .object({
          url: z.string(),
        })
        .optional()
        .nullable(),
    })
    .optional(),
  annotations: z
    .object({
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      underline: z.boolean().optional(),
      code: z.boolean().optional(),
      color: z.string().optional(),
    })
    .optional(),
});

const CommentSchema = z.object({
  object: z.literal('comment'),
  id: z.string().describe('Unique identifier for the comment.'),
  parent: z
    .object({
      type: z.string().describe('Type of parent (e.g., "page_id", "block_id").'),
      page_id: z.string().optional(),
      block_id: z.string().optional(),
    })
    .passthrough(),
  discussion_id: z.string().describe('Discussion thread ID.'),
  created_time: z.string().describe('ISO 8601 timestamp.'),
  last_edited_time: z.string().describe('ISO 8601 timestamp.'),
  created_by: z
    .object({
      object: z.literal('user'),
      id: z.string(),
      name: z.string().optional(),
      avatar_url: z.string().optional(),
      type: z.string().optional(),
      person: z
        .object({
          email: z.string(),
        })
        .optional(),
    })
    .passthrough(),
  rich_text: z.array(RichTextSchema),
});

export const listCommentsOutputSchema = z.object({
  comments: z.array(CommentSchema),
  next_cursor: z.string().optional(),
  has_more: z.boolean(),
});

export function listCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_list_comments',
    description: 'List comments for a page or discussion thread.',
    inputSchema: listCommentsInputSchema,
    outputSchema: listCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.notion.com/reference/list-comments
        endpoint: '/v1/comments',
        params: {
          block_id: input.block_id,
          ...(input.cursor && { start_cursor: input.cursor }),
          ...(input.page_size && { page_size: String(input.page_size) }),
        },
        retries: 3,
      });

      const ResponseSchema = z.object({
        object: z.literal('list'),
        results: z.array(z.unknown()),
        next_cursor: z.string().nullable(),
        has_more: z.boolean(),
      });

      const parsed = ResponseSchema.parse(response.data);

      return {
        comments: parsed.results.map(comment => CommentSchema.parse(comment)),
        ...(parsed.next_cursor !== null && { next_cursor: parsed.next_cursor }),
        has_more: parsed.has_more,
      };
    },
  });
}
