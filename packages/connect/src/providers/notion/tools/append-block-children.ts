// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const PositionAfterBlockSchema = z.object({
  type: z.literal('after_block'),
  after_block: z.object({
    id: z.string(),
  }),
});

const PositionStartSchema = z.object({
  type: z.literal('start'),
});

const PositionEndSchema = z.object({
  type: z.literal('end'),
});

const PositionSchema = z.union([PositionAfterBlockSchema, PositionStartSchema, PositionEndSchema]);

const RichTextTextSchema = z.object({
  type: z.literal('text'),
  text: z.object({
    content: z.string(),
  }),
});

const RichTextItemSchema = z.union([RichTextTextSchema]);

const ParagraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  paragraph: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const Heading1BlockSchema = z.object({
  type: z.literal('heading_1'),
  heading_1: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const Heading2BlockSchema = z.object({
  type: z.literal('heading_2'),
  heading_2: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const Heading3BlockSchema = z.object({
  type: z.literal('heading_3'),
  heading_3: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const BulletedListItemBlockSchema = z.object({
  type: z.literal('bulleted_list_item'),
  bulleted_list_item: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const NumberedListItemBlockSchema = z.object({
  type: z.literal('numbered_list_item'),
  numbered_list_item: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const ToDoBlockSchema = z.object({
  type: z.literal('to_do'),
  to_do: z.object({
    rich_text: z.array(RichTextItemSchema),
    checked: z.boolean().optional(),
  }),
});

const QuoteBlockSchema = z.object({
  type: z.literal('quote'),
  quote: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const CalloutBlockSchema = z.object({
  type: z.literal('callout'),
  callout: z.object({
    rich_text: z.array(RichTextItemSchema),
  }),
});

const CodeBlockSchema = z.object({
  type: z.literal('code'),
  code: z.object({
    rich_text: z.array(RichTextItemSchema),
    language: z.string(),
  }),
});

const DividerBlockSchema = z.object({
  type: z.literal('divider'),
  divider: z.object({}),
});

const BlockObjectSchema = z.union([
  ParagraphBlockSchema,
  Heading1BlockSchema,
  Heading2BlockSchema,
  Heading3BlockSchema,
  BulletedListItemBlockSchema,
  NumberedListItemBlockSchema,
  ToDoBlockSchema,
  QuoteBlockSchema,
  CalloutBlockSchema,
  CodeBlockSchema,
  DividerBlockSchema,
]);

export const appendBlockChildrenInputSchema = z.object({
  block_id: z.string().describe('The ID of the parent block or page. Example: "c02fc1d3-db8b-45c5-a222-27595b15aea7"'),
  children: z
    .array(BlockObjectSchema)
    .max(100)
    .describe('Array of block objects to append. Maximum 100 blocks per request.'),
  position: PositionSchema.optional().describe('Controls where to insert blocks. Defaults to end.'),
});

const UserObjectSchema = z.object({
  object: z.literal('user'),
  id: z.string(),
});

const BlockObjectResponseSchema = z.object({
  object: z.literal('block'),
  id: z.string(),
  type: z.string(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: UserObjectSchema.optional(),
  last_edited_by: UserObjectSchema.optional(),
  has_children: z.boolean().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
});

export const appendBlockChildrenOutputSchema = z.object({
  object: z.literal('list'),
  results: z.array(BlockObjectResponseSchema),
  next_cursor: z.string().nullable().optional(),
  has_more: z.boolean(),
});

const ProviderUserSchema = z.object({
  object: z.string(),
  id: z.string().optional(),
});

const ProviderBlockSchema = z.object({
  object: z.string().optional(),
  id: z.string().optional(),
  type: z.string().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  created_by: ProviderUserSchema.optional(),
  last_edited_by: ProviderUserSchema.optional(),
  has_children: z.boolean().optional(),
  archived: z.boolean().optional(),
  in_trash: z.boolean().optional(),
});

const ProviderResponseSchema = z.object({
  object: z.string(),
  results: z.array(ProviderBlockSchema).optional(),
  next_cursor: z.union([z.string(), z.null()]).optional(),
  has_more: z.boolean().optional(),
});

type BlockResponse = z.infer<typeof BlockObjectResponseSchema>;

type UserResponse = z.infer<typeof UserObjectSchema>;

export function appendBlockChildrenTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_append_block_children',
    description: 'Append new child blocks to an existing block or page.',
    inputSchema: appendBlockChildrenInputSchema,
    outputSchema: appendBlockChildrenOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof appendBlockChildrenOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: {
        children: Array<Record<string, unknown>>;
        position?: z.infer<typeof PositionSchema>;
      } = {
        children: input.children,
      };

      if (input.position !== undefined) {
        requestBody.position = input.position;
      }

      // https://developers.notion.com/reference/patch-block-children
      const response = await platformProxy.patch({
        endpoint: `/v1/blocks/${encodeURIComponent(input.block_id)}/children`,
        headers: {
          'Notion-Version': '2026-03-11',
        },
        data: requestBody,
        retries: 3,
      });

      const parsed = ProviderResponseSchema.safeParse(response.data);

      if (!parsed.success || parsed.data.object !== 'list') {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Notion API',
        });
      }

      const rawData = parsed.data;

      const results: Array<BlockResponse> = (rawData.results || []).map(block => {
        const createdBy = block.created_by;
        const lastEditedBy = block.last_edited_by;

        let createdByResult: UserResponse | undefined;
        if (createdBy && createdBy.object === 'user' && createdBy.id) {
          createdByResult = { object: 'user', id: createdBy.id };
        }

        let lastEditedByResult: UserResponse | undefined;
        if (lastEditedBy && lastEditedBy.object === 'user' && lastEditedBy.id) {
          lastEditedByResult = { object: 'user', id: lastEditedBy.id };
        }

        const result: BlockResponse = {
          object: 'block',
          id: block.id || '',
          type: block.type || '',
          created_time: block.created_time,
          last_edited_time: block.last_edited_time,
          created_by: createdByResult,
          last_edited_by: lastEditedByResult,
          has_children: block.has_children,
          archived: block.archived,
          in_trash: block.in_trash,
        };

        return result;
      });

      return {
        object: 'list',
        results,
        next_cursor: rawData.next_cursor ?? null,
        has_more: Boolean(rawData.has_more),
      };
    },
  });
}
