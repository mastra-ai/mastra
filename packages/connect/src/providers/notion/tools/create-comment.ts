// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const RichTextSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.object({
      content: z.string(),
      link: z.object({ url: z.string() }).nullable().optional(),
    }),
    annotations: z.looseObject({}).optional(),
    plain_text: z.string().optional(),
    href: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal('mention'),
    mention: z.looseObject({}),
  }),
  z.object({
    type: z.literal('equation'),
    equation: z.object({ expression: z.string() }),
  }),
  z.looseObject({}),
]);

export const createCommentInputSchema = z.union([
  z.object({
    page_id: z
      .string()
      .describe('The ID of the parent page to add a comment to. Example: "b55c9c91-384d-452b-81db-d1ef79372b75"'),
    rich_text: z.array(RichTextSchema).describe('An array of rich text objects representing the comment content'),
    markdown: z.never().optional(),
  }),
  z.object({
    page_id: z
      .string()
      .describe('The ID of the parent page to add a comment to. Example: "b55c9c91-384d-452b-81db-d1ef79372b75"'),
    markdown: z.string().describe('The comment content as a Markdown string. Supports inline formatting only.'),
    rich_text: z.never().optional(),
  }),
  z.object({
    block_id: z
      .string()
      .describe('The ID of the parent block to add a comment to. Example: "195de922-1179-449f-ab80-75a27c979105"'),
    rich_text: z.array(RichTextSchema).describe('An array of rich text objects representing the comment content'),
    markdown: z.never().optional(),
  }),
  z.object({
    block_id: z
      .string()
      .describe('The ID of the parent block to add a comment to. Example: "195de922-1179-449f-ab80-75a27c979105"'),
    markdown: z.string().describe('The comment content as a Markdown string. Supports inline formatting only.'),
    rich_text: z.never().optional(),
  }),
  z.object({
    discussion_id: z
      .string()
      .describe(
        'The ID of the existing discussion thread to add a comment to. Example: "195de922-1179-449f-ab80-75a27c979105"',
      ),
    rich_text: z.array(RichTextSchema).describe('An array of rich text objects representing the comment content'),
    markdown: z.never().optional(),
  }),
  z.object({
    discussion_id: z
      .string()
      .describe(
        'The ID of the existing discussion thread to add a comment to. Example: "195de922-1179-449f-ab80-75a27c979105"',
      ),
    markdown: z.string().describe('The comment content as a Markdown string. Supports inline formatting only.'),
    rich_text: z.never().optional(),
  }),
]);

const ProviderCommentSchema = z.object({
  object: z.literal('comment'),
  id: z.string(),
});

export const createCommentOutputSchema = z.object({
  id: z.string().describe('The ID of the created comment'),
  object: z.literal('comment'),
});

export function createCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_create_comment',
    description: 'Create a comment on a page, block, or discussion thread',
    inputSchema: createCommentInputSchema,
    outputSchema: createCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const body: Record<string, unknown> = {};

      if ('page_id' in input) {
        body['parent'] = {
          type: 'page_id',
          page_id: input.page_id,
        };
      } else if ('block_id' in input) {
        body['parent'] = {
          type: 'block_id',
          block_id: input.block_id,
        };
      } else if ('discussion_id' in input) {
        body['discussion_id'] = input.discussion_id;
      }

      if ('rich_text' in input && input.rich_text !== undefined) {
        body['rich_text'] = input.rich_text;
      } else if ('markdown' in input && input.markdown !== undefined) {
        body['markdown'] = input.markdown;
      }

      // https://developers.notion.com/reference/create-a-comment
      const response = await platformProxy.post({
        endpoint: '/v1/comments',
        headers: {
          'Notion-Version': '2026-03-11',
        },
        data: body,
        retries: 3,
      });

      const comment = ProviderCommentSchema.parse(response.data);

      return {
        id: comment.id,
        object: comment.object,
      };
    },
  });
}
