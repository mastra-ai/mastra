// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteUserInputSchema = z.object({
  userId: z.string().describe('The ID of the user to delete. Example: "1234567890"'),
});

export const deleteUserOutputSchema = z.object({
  success: z.boolean().describe('Whether the user was successfully deleted'),
  userId: z.string().describe('The ID of the deleted user'),
});

export function deleteUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_delete_user',
    description: 'Delete a Zendesk user',
    inputSchema: deleteUserInputSchema,
    outputSchema: deleteUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/users/users/#delete-user
      const response = await platformProxy.delete({
        endpoint: `/api/v2/users/${encodeURIComponent(input.userId)}.json`,
        retries: 1,
      });

      if (response.status !== 200 && response.status !== 204) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: 'Failed to delete user',
          status: response.status,
          userId: input.userId,
        });
      }

      return {
        success: true,
        userId: input.userId,
      };
    },
  });
}
