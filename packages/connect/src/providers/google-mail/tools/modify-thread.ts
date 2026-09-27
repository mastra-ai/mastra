// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const modifyThreadInputSchema = z.object({
  threadId: z.string().describe('The ID of the thread to modify. Example: "123abc456def"'),
  addLabelIds: z.array(z.string()).optional().describe('A list of label IDs to add to the thread.'),
  removeLabelIds: z.array(z.string()).optional().describe('A list of label IDs to remove from the thread.'),
});

const ThreadSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
});

export const modifyThreadOutputSchema = z.object({
  id: z.string().describe('The ID of the modified thread.'),
  historyId: z.string().optional().describe('The history ID of the thread.'),
  messages: z.array(z.unknown()).optional(),
});

export function modifyThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_modify_thread',
    description: 'Add and remove labels across a Gmail thread.',
    inputSchema: modifyThreadInputSchema,
    outputSchema: modifyThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof modifyThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      if (
        (!input.addLabelIds || input.addLabelIds.length === 0) &&
        (!input.removeLabelIds || input.removeLabelIds.length === 0)
      ) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one of addLabelIds or removeLabelIds must be provided with at least one label ID.',
        });
      }

      const requestBody: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};
      if (input.addLabelIds && input.addLabelIds.length > 0) {
        requestBody.addLabelIds = input.addLabelIds;
      }
      if (input.removeLabelIds && input.removeLabelIds.length > 0) {
        requestBody.removeLabelIds = input.removeLabelIds;
      }

      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/modify
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/me/threads/${encodeURIComponent(input.threadId)}/modify`,
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Thread not found or could not be modified.',
          threadId: input.threadId,
        });
      }

      const thread = ThreadSchema.parse(response.data);

      return {
        id: thread.id,
        ...(thread.historyId && { historyId: thread.historyId }),
        ...(thread.messages && { messages: thread.messages }),
      };
    },
  });
}
