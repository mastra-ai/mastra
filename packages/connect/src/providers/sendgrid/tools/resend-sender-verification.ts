// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const resendSenderVerificationInputSchema = z.object({
  sender_id: z.string().describe('The ID of the sender identity to resend verification for. Example: "9389986"'),
});

export const resendSenderVerificationOutputSchema = z.object({
  success: z.boolean(),
});

export function resendSenderVerificationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_resend_sender_verification',
    description: 'Resend the verification email for a sender identity.',
    inputSchema: resendSenderVerificationInputSchema,
    outputSchema: resendSenderVerificationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof resendSenderVerificationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/sender-identity/resend-verification
      await platformProxy.post({
        endpoint: `/v3/verified_senders/resend/${encodeURIComponent(input.sender_id)}`,
        retries: 10,
      });

      return { success: true };
    },
  });
}
