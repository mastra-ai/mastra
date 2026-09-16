// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const resolveCommentInputSchema = z.object({
  id: z.string().describe('The identifier of the comment to resolve. Example: "comment-id-123"'),
  resolvingCommentId: z
    .string()
    .optional()
    .describe(
      'The identifier of the child comment that resolves the thread. If not provided, the thread is resolved without a specific resolving comment.',
    ),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      commentResolve: z.object({
        success: z.boolean(),
        lastSyncId: z.number().optional(),
        comment: z
          .object({
            id: z.string(),
          })
          .optional()
          .nullable(),
      }),
    })
    .optional()
    .nullable(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export const resolveCommentOutputSchema = z.object({
  success: z.boolean(),
  commentId: z.string().optional(),
  lastSyncId: z.number().optional(),
});

export function resolveCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_resolve_comment',
    description: 'Resolve a Linear comment thread.',
    inputSchema: resolveCommentInputSchema,
    outputSchema: resolveCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof resolveCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation commentResolve($id: String!, $resolvingCommentId: String) {
                        commentResolve(id: $id, resolvingCommentId: $resolvingCommentId) {
                            success
                            lastSyncId
                            comment {
                                id
                            }
                        }
                    }
                `,
          variables: {
            id: input.id,
            ...(input.resolvingCommentId !== undefined && { resolvingCommentId: input.resolvingCommentId }),
          },
        },
        retries: 1,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      if (providerData.errors && providerData.errors.length > 0) {
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: providerData.errors.map(e => e.message).join(', '),
        });
      }

      if (!providerData.data || !providerData.data.commentResolve) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid response from Linear API',
        });
      }

      const payload = providerData.data.commentResolve;

      if (!payload.success) {
        throw new platformProxy.ActionError({
          type: 'resolve_failed',
          message: 'Failed to resolve comment',
          commentId: input.id,
        });
      }

      return {
        success: payload.success,
        ...(payload.comment?.id != null && { commentId: payload.comment.id }),
        ...(payload.lastSyncId != null && { lastSyncId: payload.lastSyncId }),
      };
    },
  });
}
