// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const modifyMessageInputSchema = z.object({
  id: z.string().describe('The ID of the message to modify. Example: "1234567890abcdef"'),
  addLabelIds: z.array(z.string()).optional().describe('A list of label IDs to add to the message.'),
  removeLabelIds: z.array(z.string()).optional().describe('A list of label IDs to remove from the message.'),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: z.unknown().optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(),
});

export const modifyMessageOutputSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  sizeEstimate: z.number().optional(),
});

export function modifyMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_modify_message',
    description: 'Add and remove labels on a Gmail message',
    inputSchema: modifyMessageInputSchema,
    outputSchema: modifyMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof modifyMessageOutputSchema>> => {
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

      const requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};
      if (input.addLabelIds && input.addLabelIds.length > 0) {
        requestBody.addLabelIds = input.addLabelIds;
      }
      if (input.removeLabelIds && input.removeLabelIds.length > 0) {
        requestBody.removeLabelIds = input.removeLabelIds;
      }

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/modify
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/me/messages/${encodeURIComponent(input.id)}/modify`,
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found or could not be modified',
          message_id: input.id,
        });
      }

      const message = ProviderMessageSchema.parse(response.data);

      return {
        id: message.id,
        ...(message.threadId !== undefined && { threadId: message.threadId }),
        ...(message.labelIds !== undefined && { labelIds: message.labelIds }),
        ...(message.snippet !== undefined && { snippet: message.snippet }),
        ...(message.historyId !== undefined && { historyId: message.historyId }),
        ...(message.internalDate !== undefined && { internalDate: message.internalDate }),
        ...(message.sizeEstimate !== undefined && { sizeEstimate: message.sizeEstimate }),
      };
    },
  });
}
