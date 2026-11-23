// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const addGroupSuppressionsInputSchema = z.object({
  group_id: z.number().describe('The ID of the unsubscribe group. Example: 254515'),
  recipient_emails: z
    .array(z.string().email())
    .describe('Email addresses to add to the group suppressions. Example: ["user@example.com"]'),
});

export const addGroupSuppressionsOutputSchema = z.object({
  recipient_emails: z.array(z.string()).describe('The email addresses added to the unsubscribe group.'),
});

export function addGroupSuppressionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_add_group_suppressions',
    description: 'Unsubscribe email addresses from a specific group.',
    inputSchema: addGroupSuppressionsInputSchema,
    outputSchema: addGroupSuppressionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addGroupSuppressionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-suppressions/add-suppressions-to-a-suppression-group
        endpoint: `/v3/asm/groups/${encodeURIComponent(String(input.group_id))}/suppressions`,
        data: {
          recipient_emails: input.recipient_emails,
        },
        retries: 3,
      });

      return addGroupSuppressionsOutputSchema.parse(response.data);
    },
  });
}
