// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteAttachmentInputSchema = z.object({
  attachmentId: z
    .string()
    .describe('The identifier of the attachment to delete. Example: "f4485af5-5d5a-4baf-bb8f-d66cbf7254c8"'),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      attachmentDelete: z
        .object({
          success: z.boolean(),
          lastSyncId: z.number().optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        extensions: z
          .object({
            code: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export const deleteAttachmentOutputSchema = z.object({
  success: z.boolean(),
  attachmentId: z.string().optional(),
});

export function deleteAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'linear_delete_attachment',
    description: 'Delete an attachment from a Linear issue.',
    inputSchema: deleteAttachmentInputSchema,
    outputSchema: deleteAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://linear.app/developers/graphql
        endpoint: '/graphql',
        data: {
          query: `
                    mutation AttachmentDelete($id: String!) {
                        attachmentDelete(id: $id) {
                            success
                            lastSyncId
                        }
                    }
                `,
          variables: {
            id: input.attachmentId,
          },
        },
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Unexpected empty response from provider.',
        });
      }

      const body = GraphQLResponseSchema.parse(response.data);

      const firstError = body.errors?.find(() => true);
      if (firstError) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: firstError.message,
          code: firstError.extensions?.code,
        });
      }

      if (!body.data?.attachmentDelete?.success) {
        throw new platformProxy.ActionError({
          type: 'deletion_failed',
          message: 'Attachment deletion was not successful.',
          attachmentId: input.attachmentId,
        });
      }

      return {
        success: body.data.attachmentDelete.success,
        attachmentId: input.attachmentId,
      };
    },
  });
}
