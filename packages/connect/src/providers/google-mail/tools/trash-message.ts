// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const trashMessageInputSchema = z.object({
  id: z.string().describe('The ID of the message to trash. Example: "16e69b9f7e6e0f8b"'),
});

const ProviderMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(),
});

export const trashMessageOutputSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  sizeEstimate: z.number().optional(),
});

export function trashMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_trash_message',
    description: 'Move a Gmail message to trash',
    inputSchema: trashMessageInputSchema,
    outputSchema: trashMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof trashMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/trash
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/me/messages/${encodeURIComponent(input.id)}/trash`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Message not found',
          id: input.id,
        });
      }

      const providerMessage = ProviderMessageSchema.parse(response.data);

      return {
        id: providerMessage.id,
        threadId: providerMessage.threadId,
        ...(providerMessage.labelIds !== undefined && { labelIds: providerMessage.labelIds }),
        ...(providerMessage.snippet !== undefined && { snippet: providerMessage.snippet }),
        ...(providerMessage.historyId !== undefined && { historyId: providerMessage.historyId }),
        ...(providerMessage.internalDate !== undefined && { internalDate: providerMessage.internalDate }),
        ...(providerMessage.sizeEstimate !== undefined && { sizeEstimate: providerMessage.sizeEstimate }),
      };
    },
  });
}
