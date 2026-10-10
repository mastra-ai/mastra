// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const sendDraftMessageInputSchema = z.object({
  message_id: z.string().describe('The unique identifier of the draft message to send. Example: "AAMkAGVmMDEz..."'),
});

export const sendDraftMessageOutputSchema = z.object({
  success: z.boolean().describe('Whether the draft was sent successfully'),
  message_id: z
    .string()
    .describe(
      'The ID of the draft that was sent. This equals the input draft ID; the send endpoint returns no body to confirm the sent item ID.',
    ),
});

export function sendDraftMessageTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_send_draft_message',
    description: 'Send an existing draft message.',
    inputSchema: sendDraftMessageInputSchema,
    outputSchema: sendDraftMessageOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof sendDraftMessageOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/message-send
      await platformProxy.post({
        endpoint: `/v1.0/me/messages/${encodeURIComponent(input.message_id)}/send`,
        retries: 3,
      });

      return {
        success: true,
        message_id: input.message_id,
      };
    },
  });
}
