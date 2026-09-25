// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteUserInputSchema = z.object({ user_id: z.string().min(1) });

export const deleteUserOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_user',
    description: 'Delete a Clerk user.',
    inputSchema: deleteUserInputSchema,
    outputSchema: deleteUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://clerk.com/docs/reference/backend-api/tag/Users#operation/DeleteUser
      await platformProxy.delete({ endpoint: `/v1/users/${encodeURIComponent(input.user_id)}`, retries: 3 });
      return { id: input.user_id, success: true };
    },
  });
}
