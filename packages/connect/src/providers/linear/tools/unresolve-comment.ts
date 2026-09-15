// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const unresolveCommentInputSchema = z.object({
  id: z.string().describe('The identifier of the comment to unresolve. Example: "comment-id-123"'),
});

const ProviderPayloadSchema = z.object({
  data: z.object({
    commentUnresolve: z.object({
      success: z.boolean(),
      lastSyncId: z.union([z.string(), z.number()]),
      comment: z.object({
        id: z.string(),
      }),
    }),
  }),
});

export const unresolveCommentOutputSchema = z.object({
  success: z.boolean().describe('Whether the operation was successful.'),
  lastSyncId: z.string().describe('The identifier of the last sync operation.'),
  commentId: z.string().describe('The identifier of the unresolved comment.'),
});

export function unresolveCommentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_unresolve_comment',
    description: 'Reopen a previously resolved Linear comment thread.',
    inputSchema: unresolveCommentInputSchema,
    outputSchema: unresolveCommentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof unresolveCommentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://linear.app/developers/graphql
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query:
            'mutation commentUnresolve($id: String!) { commentUnresolve(id: $id) { success lastSyncId comment { id } } }',
          variables: {
            id: input.id,
          },
        },
        retries: 3,
      });

      const providerPayload = ProviderPayloadSchema.parse(response.data);

      return {
        success: providerPayload.data.commentUnresolve.success,
        lastSyncId: String(providerPayload.data.commentUnresolve.lastSyncId),
        commentId: providerPayload.data.commentUnresolve.comment.id,
      };
    },
  });
}
