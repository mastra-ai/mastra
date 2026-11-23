// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteSuppressionGroupInputSchema = z.object({
  group_id: z.number().describe('The ID of the unsubscribe group to delete. Example: 12345'),
});

export const deleteSuppressionGroupOutputSchema = z.object({
  success: z.boolean(),
});

export function deleteSuppressionGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'sendgrid_delete_suppression_group',
    description: 'Delete an unsubscribe group.',
    inputSchema: deleteSuppressionGroupInputSchema,
    outputSchema: deleteSuppressionGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSuppressionGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.delete({
        // https://www.twilio.com/docs/sendgrid/api-reference/suppressions-api-delete-a-suppression-group
        endpoint: `/v3/asm/groups/${encodeURIComponent(String(input.group_id))}`,
        retries: 3,
      });

      if (response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: `Expected 204 but received ${response.status}`,
          group_id: input.group_id,
        });
      }

      return {
        success: true,
      };
    },
  });
}
