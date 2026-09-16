// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteAuthUserInputSchema = z.object({
  user_id: z
    .string()
    .uuid()
    .describe('The UUID of the auth user to delete. Example: "afece930-4935-43c3-9484-46bc38da98f7"'),
});

export const deleteAuthUserOutputSchema = z.object({
  success: z.boolean(),
  user_id: z.string(),
});

export function deleteAuthUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'supabase_delete_auth_user',
    description: 'Delete or archive a auth user in Supabase.',
    inputSchema: deleteAuthUserInputSchema,
    outputSchema: deleteAuthUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteAuthUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const connection = await platformProxy.getConnection();
      const projectUrl = connection.connection_config?.['projectUrl'];
      const baseUrlOverride =
        typeof projectUrl === 'string'
          ? projectUrl.startsWith('http')
            ? projectUrl
            : `https://${projectUrl}`
          : undefined;

      const encodedUserId = encodeURIComponent(input.user_id);

      const config: PlatformProxyRequest = {
        // https://supabase.com/docs/reference/api/delete-a-user
        endpoint: `/auth/v1/admin/users/${encodedUserId}`,
        baseUrlOverride,
        retries: 3,
      };

      const response = await platformProxy.delete(config);

      if (response.status !== 200) {
        throw new platformProxy.ActionError({
          type: 'delete_failed',
          message: `Failed to delete user. Status: ${response.status}`,
          user_id: input.user_id,
        });
      }

      return {
        success: true,
        user_id: input.user_id,
      };
    },
  });
}
