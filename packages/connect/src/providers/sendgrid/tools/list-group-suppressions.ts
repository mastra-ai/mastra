// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listGroupSuppressionsInputSchema = z.object({
  group_id: z.string().describe('The ID of the suppression group. Example: "254514"'),
});

export const listGroupSuppressionsOutputSchema = z.object({
  emails: z.array(z.string()),
});

export function listGroupSuppressionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_list_group_suppressions',
    description: 'List the email addresses unsubscribed from a specific group.',
    inputSchema: listGroupSuppressionsInputSchema,
    outputSchema: listGroupSuppressionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listGroupSuppressionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-unsubscribe-groups-retrieve-all-suppressions-for-a-group
        endpoint: `/v3/asm/groups/${encodeURIComponent(input.group_id)}/suppressions`,
        retries: 3,
      });

      const emails = z.array(z.string()).parse(response.data);

      return {
        emails,
      };
    },
  });
}
