// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const batchDeleteMessagesInputSchema = z.object({
  ids: z.array(z.string()).min(1).describe('Array of Gmail message IDs to delete. Example: ["msg123", "msg456"]'),
});

export const batchDeleteMessagesOutputSchema = z.null();

export function batchDeleteMessagesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_batch_delete_messages',
    description: 'Permanently delete multiple Gmail messages by ID',
    inputSchema: batchDeleteMessagesInputSchema,
    outputSchema: batchDeleteMessagesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchDeleteMessagesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/batchDelete
      await platformProxy.post({
        endpoint: '/gmail/v1/users/me/messages/batchDelete',
        data: {
          ids: input.ids,
        },
        retries: 2,
      });

      return null;
    },
  });
}
