// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteMessageInputSchema = z.object({
  messageId: z.string().describe('The unique identifier of the message to delete. Example: "AAMkAGVmMDEzM..."'),
});

export const deleteMessageOutputSchema = z.object({
  success: z.boolean().describe('Whether the deletion was successful'),
});

export function deleteMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_delete_message',
    description: 'Delete a message from the mailbox',
    inputSchema: deleteMessageInputSchema,
    outputSchema: deleteMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/message-delete
      await platformProxy.delete({
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.messageId)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
