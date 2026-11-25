// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteGroupSuppressionInputSchema = z.object({
  group_id: z.number().describe('The ID of the suppression group. Example: 254514'),
  email: z
    .string()
    .email()
    .describe('The email address to remove from the suppression group. Example: user@example.com'),
});

export const deleteGroupSuppressionOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteGroupSuppressionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_group_suppression',
    description: "Remove a single email address's unsubscribe from a specific group.",
    inputSchema: deleteGroupSuppressionInputSchema,
    outputSchema: deleteGroupSuppressionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteGroupSuppressionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-delete-a-suppression-from-a-suppression-group
        endpoint: `/v3/asm/groups/${encodeURIComponent(input.group_id)}/suppressions/${encodeURIComponent(input.email)}`,
        retries: 3,
      });

      return {
        success: true,
      };
    },
  });
}
