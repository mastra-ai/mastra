// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const untrashMessageInputSchema = z.object({
  id: z.string().describe('The ID of the message to untrash. Example: "1234567890abcdef"'),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: z.object({}).passthrough().optional(),
  sizeEstimate: z.number().optional(),
});

export const untrashMessageOutputSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  sizeEstimate: z.number().optional(),
});

export function untrashMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_untrash_message',
    description: 'Restore a trashed Gmail message to the mailbox.',
    inputSchema: untrashMessageInputSchema,
    outputSchema: untrashMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof untrashMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/untrash
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/me/messages/${encodeURIComponent(input.id)}/untrash`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found or could not be restored from trash',
          id: input.id,
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
