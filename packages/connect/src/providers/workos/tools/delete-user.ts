// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteUserInputSchema = z.object({
  user_id: z.string().min(1).describe('WorkOS user ID. Example: "user_01H..."'),
});

export const deleteUserOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_delete_user',
    description: 'Permanently delete a WorkOS user.',
    inputSchema: deleteUserInputSchema,
    outputSchema: deleteUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://workos.com/docs/reference/user-management/user
        endpoint: `/user_management/users/${encodeURIComponent(input.user_id)}`,
        retries: 3,
      });
      return { id: input.user_id, success: true };
    },
  });
}
