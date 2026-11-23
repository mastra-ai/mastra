// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSenderIdentityInputSchema = z.object({
  sender_id: z.string().describe('Sender identity ID. Example: "9389987"'),
});

export const deleteSenderIdentityOutputSchema = z.object({
  success: z.literal(true),
});

export function deleteSenderIdentityTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_sender_identity',
    description: 'Delete a sender identity.',
    inputSchema: deleteSenderIdentityInputSchema,
    outputSchema: deleteSenderIdentityOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSenderIdentityOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/sender-verification/delete-sender
        endpoint: `/v3/verified_senders/${encodeURIComponent(input.sender_id)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
