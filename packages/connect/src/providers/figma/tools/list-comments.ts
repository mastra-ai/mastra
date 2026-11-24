// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCommentsInputSchema = z.object({
  file_key: z.string().describe('File key to list comments from. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  as_md: z.boolean().optional().describe('If enabled, returns comments as markdown equivalents when applicable.'),
});

const VectorSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const FrameOffsetSchema = z.object({
  node_id: z.string(),
  node_offset: VectorSchema,
});

const RegionSchema = z.object({
  x: z.number(),
  y: z.number(),
  region_height: z.number(),
  region_width: z.number(),
  comment_pin_corner: z.string().optional(),
});

const FrameOffsetRegionSchema = z.object({
  node_id: z.string(),
  node_offset: VectorSchema,
  region_height: z.number(),
  region_width: z.number(),
  comment_pin_corner: z.string().optional(),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string(),
});

const ReactionSchema = z.object({
  user: UserSchema,
  emoji: z.string(),
  created_at: z.string(),
});

const ProviderCommentSchema = z.object({
  id: z.string(),
  client_meta: z.union([FrameOffsetRegionSchema, RegionSchema, FrameOffsetSchema, VectorSchema]).nullable(),
  file_key: z.string(),
  parent_id: z.string().optional(),
  user: UserSchema,
  created_at: z.string(),
  resolved_at: z.string().nullish(),
  message: z.string(),
  order_id: z.string().nullable(),
  reactions: z.array(ReactionSchema),
});

const CommentSchema = z.object({
  id: z.string(),
  file_key: z.string(),
  client_meta: z.union([FrameOffsetRegionSchema, RegionSchema, FrameOffsetSchema, VectorSchema]).optional(),
  parent_id: z.string().optional(),
  user: UserSchema,
  created_at: z.string(),
  resolved_at: z.string().optional(),
  message: z.string(),
  order_id: z.string().optional(),
  reactions: z.array(ReactionSchema),
});

export const listCommentsOutputSchema = z.object({
  items: z.array(CommentSchema),
});

export function listCommentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_list_comments',
    description: 'List comments from Figma.',
    inputSchema: listCommentsInputSchema,
    outputSchema: listCommentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCommentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.figma.com/developers/api#get-comments-endpoint
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/comments`,
        params: {
          ...(input.as_md !== undefined && { as_md: String(input.as_md) }),
        },
        retries: 3,
      });

      const providerResponse = z
        .object({
          comments: z.array(z.unknown()),
        })
        .parse(response.data);

      const items = providerResponse.comments.map(raw => {
        const providerComment = ProviderCommentSchema.parse(raw);
        return {
          id: providerComment.id,
          file_key: providerComment.file_key,
          user: providerComment.user,
          created_at: providerComment.created_at,
          message: providerComment.message,
          reactions: providerComment.reactions,
          ...(providerComment.client_meta != null && { client_meta: providerComment.client_meta }),
          ...(providerComment.parent_id !== undefined && { parent_id: providerComment.parent_id }),
          ...(providerComment.resolved_at != null && { resolved_at: providerComment.resolved_at }),
          ...(providerComment.order_id !== null && { order_id: providerComment.order_id }),
        };
      });

      return {
        items,
      };
    },
  });
}
