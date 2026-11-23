// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteGlobalSuppressionInputSchema = z.object({
  email: z.string().describe('Email address to remove from the global suppression list. Example: "user@example.com"'),
});

export const deleteGlobalSuppressionOutputSchema = z.object({
  email: z.string(),
});

export function deleteGlobalSuppressionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_global_suppression',
    description: 'Remove a single email address from the global suppression list.',
    inputSchema: deleteGlobalSuppressionInputSchema,
    outputSchema: deleteGlobalSuppressionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteGlobalSuppressionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-global-suppressions/delete-a-globally-suppressed-email-address
      await platformProxy.delete({
        endpoint: `/v3/asm/suppressions/global/${encodeURIComponent(input.email)}`,
        retries: 3,
      });

      return {
        email: input.email,
      };
    },
  });
}
