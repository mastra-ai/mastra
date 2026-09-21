// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteMessageInputSchema = z.object({
  id: z.string().describe('The ID of the message to delete. Example: "123abc456def"'),
});

export const deleteMessageOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
  id: z.string().describe('The ID of the deleted message'),
});

export function deleteMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_delete_message',
    description: 'Permanently delete a Gmail message by ID.',
    inputSchema: deleteMessageInputSchema,
    outputSchema: deleteMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/delete
      await platformProxy.delete({
        endpoint: `/gmail/v1/users/me/messages/${encodeURIComponent(input.id)}`,
        retries: 10,
      });

      return {
        success: true,
        id: input.id,
      };
    },
  });
}
