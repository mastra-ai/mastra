// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const sendMessageInputSchema = z.object({
  raw: z.string().describe('The base64url-encoded MIME content of the email message to send.'),
  threadId: z.string().optional().describe('The ID of the thread to reply to. If omitted, a new thread is created.'),
});

export const sendMessageOutputSchema = z.object({
  id: z.string().describe('The ID of the sent message.'),
  threadId: z.string().describe('The ID of the thread the message belongs to.'),
  labelIds: z.array(z.string()).optional().describe('List of label IDs applied to the message.'),
  snippet: z.string().optional().describe('A short snippet of the message text.'),
  historyId: z.string().optional().describe('The history ID of the message.'),
  internalDate: z.string().optional().describe('The internal date of the message in milliseconds since epoch.'),
});

export function sendMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_send_message',
    description: 'Send an email message through Gmail using raw MIME content.',
    inputSchema: sendMessageInputSchema,
    outputSchema: sendMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const payload: { raw: string; threadId?: string } = {
        raw: input.raw,
      };

      if (input.threadId !== undefined) {
        payload.threadId = input.threadId;
      }

      // https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
      const response = await platformProxy.post({
        endpoint: '/gmail/v1/users/me/messages/send',
        data: payload,
        retries: 3,
      });

      const sentMessage = sendMessageOutputSchema.parse(response.data);

      return {
        id: sentMessage.id,
        threadId: sentMessage.threadId,
        ...(sentMessage.labelIds !== undefined && { labelIds: sentMessage.labelIds }),
        ...(sentMessage.snippet !== undefined && { snippet: sentMessage.snippet }),
        ...(sentMessage.historyId !== undefined && { historyId: sentMessage.historyId }),
        ...(sentMessage.internalDate !== undefined && { internalDate: sentMessage.internalDate }),
      };
    },
  });
}
