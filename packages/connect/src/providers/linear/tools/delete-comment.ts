// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteCommentInputSchema = z.object({
  commentId: z.string().describe('The ID of the comment to delete. Example: "abc123"'),
});

const ProviderResponseSchema = z.object({
  data: z.object({
    commentDelete: z.object({
      success: z.boolean(),
    }),
  }),
});

export const deleteCommentOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_delete_comment',
    description: 'Delete a comment from a Linear issue.',
    inputSchema: deleteCommentInputSchema,
    outputSchema: deleteCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: 'mutation CommentDelete($id: String!) { commentDelete(id: $id) { success } }',
          variables: {
            id: input.commentId,
          },
        },
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Linear API returned an empty response.',
        });
      }

      const parsed = ProviderResponseSchema.safeParse(response.data);

      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Linear API returned an unexpected response shape.',
          details: parsed.error.issues,
        });
      }

      return {
        success: parsed.data.data.commentDelete.success,
      };
    },
  });
}
