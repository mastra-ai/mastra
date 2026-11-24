// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteConversationInputSchema = z.object({
  conversation_id: z.string().describe('The ID of the conversation to delete. Example: "abc123"'),
});

export const deleteConversationOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteConversationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'elevenlabs_delete_conversation',
    description: 'Delete a Conversational AI conversation.',
    inputSchema: deleteConversationInputSchema,
    outputSchema: deleteConversationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteConversationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://elevenlabs.io/docs/api-reference/conversations/delete
        endpoint: `/v1/convai/conversations/${encodeURIComponent(input.conversation_id)}`,
        retries: 3,
      });

      if (response.status !== 200 && response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: `Failed to delete conversation. Received status ${response.status}.`,
        });
      }

      return {
        success: true,
      };
    },
  });
}
