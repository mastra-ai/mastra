// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateCommentInputSchema = z.object({
  id: z.string().describe('The ID of the comment to update. Example: "comment-id-123"'),
  body: z.string().describe('The new text content for the comment.'),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      commentUpdate: z
        .object({
          success: z.boolean(),
          comment: z
            .object({
              id: z.string(),
              body: z.string().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export const updateCommentOutputSchema = z.object({
  id: z.string(),
  body: z.string().optional(),
});

export function updateCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_update_comment',
    description: 'Update a comment on a Linear issue.',
    inputSchema: updateCommentInputSchema,
    outputSchema: updateCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `mutation UpdateComment($id: String!, $body: String!) {
  commentUpdate(id: $id, input: { body: $body }) {
    success
    comment {
      id
      body
    }
  }
}`,
          variables: {
            id: input.id,
            body: input.body,
          },
        },
        retries: 1,
      });

      const payload = GraphQLResponseSchema.parse(response.data);

      if (payload.errors && payload.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: payload.errors.map(e => e.message).join(', '),
        });
      }

      const commentUpdate = payload.data?.commentUpdate;
      if (!commentUpdate || !commentUpdate.success) {
        throw new platformProxy.ActionError({
          type: 'update_failed',
          message: 'Comment update was not successful.',
        });
      }

      if (!commentUpdate.comment) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Updated comment was not returned.',
        });
      }

      return {
        id: commentUpdate.comment.id,
        ...(commentUpdate.comment.body != null && { body: commentUpdate.comment.body }),
      };
    },
  });
}
