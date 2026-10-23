// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const untrashThreadInputSchema = z.object({
  threadId: z.string().describe('The ID of the thread to restore from trash. Example: "18abc123def456"'),
});

const ProviderThreadSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        threadId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        snippet: z.string().optional(),
        historyId: z.string().optional(),
        internalDate: z.string().optional(),
      }),
    )
    .optional(),
});

export const untrashThreadOutputSchema = z.object({
  id: z.string(),
  historyId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string(),
        threadId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        snippet: z.string().optional(),
        historyId: z.string().optional(),
        internalDate: z.string().optional(),
      }),
    )
    .optional(),
});

export function untrashThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_untrash_thread',
    description: 'Restore a trashed Gmail thread to the mailbox.',
    inputSchema: untrashThreadInputSchema,
    outputSchema: untrashThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof untrashThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/untrash
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/me/threads/${encodeURIComponent(input.threadId)}/untrash`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Thread not found or could not be restored',
          threadId: input.threadId,
        });
      }

      const providerThread = ProviderThreadSchema.parse(response.data);

      return {
        id: providerThread.id,
        ...(providerThread.historyId && { historyId: providerThread.historyId }),
        ...(providerThread.messages && { messages: providerThread.messages }),
      };
    },
  });
}
