// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addGlobalSuppressionsInputSchema = z.object({
  recipient_emails: z
    .array(z.string().email())
    .describe('Array of email addresses to add to the global suppression list. Example: ["a@x.com", "b@x.com"]'),
});

export const addGlobalSuppressionsOutputSchema = z.object({
  recipient_emails: z
    .array(z.string().email())
    .describe('The email addresses that were added to the global suppression list'),
});

export function addGlobalSuppressionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_add_global_suppressions',
    description: 'Add email addresses to the global suppression (unsubscribe) list',
    inputSchema: addGlobalSuppressionsInputSchema,
    outputSchema: addGlobalSuppressionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addGlobalSuppressionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.sendgrid.com/api-reference/suppressions-global-suppressions/add-recipient-addresses-to-the-global-suppression-group
        endpoint: '/v3/asm/suppressions/global',
        data: {
          recipient_emails: input.recipient_emails,
        },
        retries: 3,
      });

      const parsed = addGlobalSuppressionsOutputSchema.parse(response.data);

      return parsed;
    },
  });
}
