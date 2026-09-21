// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const trashThreadInputSchema = z.object({
  thread_id: z.string().describe('The ID of the thread to trash. Example: "18e0b4e6c8a0b9e2"'),
});

const MessagePartSchema = z.object({}).passthrough();

const MessageSchema = z.object({
  id: z.string().optional(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  internalDate: z.string().optional(),
  payload: MessagePartSchema.optional(),
  sizeEstimate: z.number().optional(),
  raw: z.string().optional(),
});

const ProviderThreadSchema = z.object({
  id: z.string(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
});

export const trashThreadOutputSchema = z.object({
  id: z.string(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  messages: z.array(MessageSchema).optional(),
});

export function trashThreadTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_trash_thread',
    description: 'Move a Gmail thread to trash.',
    inputSchema: trashThreadInputSchema,
    outputSchema: trashThreadOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof trashThreadOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.threads/trash
      const response = await platformProxy.post({
        endpoint: `/gmail/v1/users/me/threads/${encodeURIComponent(input.thread_id)}/trash`,
        retries: 10,
      });

      const providerThread = ProviderThreadSchema.parse(response.data);

      return {
        id: providerThread.id,
        ...(providerThread.snippet !== undefined && { snippet: providerThread.snippet }),
        ...(providerThread.historyId !== undefined && { historyId: providerThread.historyId }),
        ...(providerThread.messages !== undefined && { messages: providerThread.messages }),
      };
    },
  });
}
