// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const batchModifyMessagesInputSchema = z.object({
  ids: z.array(z.string()).min(1).max(1000).describe('The IDs of the messages to modify. Maximum 1000.'),
  addLabelIds: z.array(z.string()).optional().describe('Label IDs to add to all messages.'),
  removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove from all messages.'),
});

export const batchModifyMessagesOutputSchema = z.object({
  success: z.boolean().describe('Whether the batch modification was successful.'),
  modifiedCount: z.number().describe('Number of messages modified.'),
});

export function batchModifyMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_batch_modify_messages',
    description: 'Add and remove labels on multiple Gmail messages at once.',
    inputSchema: batchModifyMessagesInputSchema,
    outputSchema: batchModifyMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchModifyMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (
        (!input.addLabelIds || input.addLabelIds.length === 0) &&
        (!input.removeLabelIds || input.removeLabelIds.length === 0)
      ) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of addLabelIds or removeLabelIds must be provided with at least one label ID',
        });
      }

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/batchModify
      await platformProxy.post({
        endpoint: '/gmail/v1/users/me/messages/batchModify',
        data: {
          ids: input.ids,
          ...(input.addLabelIds && input.addLabelIds.length > 0 && { addLabelIds: input.addLabelIds }),
          ...(input.removeLabelIds && input.removeLabelIds.length > 0 && { removeLabelIds: input.removeLabelIds }),
        },
        retries: 3,
      });

      return {
        success: true,
        modifiedCount: input.ids.length,
      };
    },
  });
}
