// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCommentInputSchema = z.object({
  file_key: z.string().describe('Figma file key. Example: "UzYlOaPNPL2c7zmHCEljOs"'),
  comment_id: z.string().describe('Comment ID. Example: "1774450119"'),
});

const UserSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string().optional(),
  email: z.string().optional(),
});

const NodeOffsetSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const ClientMetaSchema = z.object({
  node_id: z.string().optional(),
  node_offset: NodeOffsetSchema.optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  region_height: z.number().optional(),
  region_width: z.number().optional(),
  comment_pin_corner: z.string().optional(),
});

const ProviderCommentSchema = z.object({
  id: z.string(),
  file_key: z.string().optional(),
  parent_id: z.string().nullable().optional(),
  user: UserSchema,
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  message: z.string(),
  client_meta: ClientMetaSchema.nullable().optional(),
  order_id: z.string().nullish(),
});

const ProviderCommentsResponseSchema = z.object({
  comments: z.array(ProviderCommentSchema),
});

export const getCommentOutputSchema = z.object({
  id: z.string(),
  file_key: z.string().optional(),
  parent_id: z.string().optional(),
  user: z.object({
    id: z.string(),
    handle: z.string(),
    img_url: z.string().optional(),
    email: z.string().optional(),
  }),
  created_at: z.string(),
  resolved_at: z.string().optional(),
  message: z.string(),
  client_meta: ClientMetaSchema.optional(),
  order_id: z.string().nullish(),
});

export function getCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_comment',
    description: 'Retrieve a single comment from Figma.',
    inputSchema: getCommentInputSchema,
    outputSchema: getCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.figma.com/developers/api#get-comments-endpoint
      const response = await platformProxy.get({
        endpoint: `/v1/files/${encodeURIComponent(input.file_key)}/comments`,
        retries: 3,
      });

      const providerResponse = ProviderCommentsResponseSchema.parse(response.data);
      const comment = providerResponse.comments.find(c => c.id === input.comment_id);

      if (!comment) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Comment ${input.comment_id} not found in file ${input.file_key}.`,
        });
      }

      return {
        id: comment.id,
        ...(comment.file_key !== undefined && { file_key: comment.file_key }),
        ...(comment.parent_id != null && { parent_id: comment.parent_id }),
        user: {
          id: comment.user.id,
          handle: comment.user.handle,
          ...(comment.user.img_url !== undefined && { img_url: comment.user.img_url }),
          ...(comment.user.email !== undefined && { email: comment.user.email }),
        },
        created_at: comment.created_at,
        ...(comment.resolved_at != null && { resolved_at: comment.resolved_at }),
        message: comment.message,
        ...(comment.client_meta != null && { client_meta: comment.client_meta }),
        ...(comment.order_id != null && { order_id: comment.order_id }),
      };
    },
  });
}
