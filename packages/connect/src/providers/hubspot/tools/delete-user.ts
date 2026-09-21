// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteUserInputSchema = z.object({
  userId: z
    .string()
    .describe(
      'HubSpot user ID. Example: "12345678". Can also be an email address if using the optional idProperty query parameter.',
    ),
  idProperty: z
    .enum(['USER_ID', 'EMAIL'])
    .optional()
    .describe(
      'Property to use for identifying the user. Defaults to USER_ID. Use EMAIL if passing an email address as user_id.',
    ),
});

export const deleteUserOutputSchema = z.object({
  id: z.string(),
  deleted: z.boolean(),
});

export function deleteUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_delete_user',
    description: 'Delete a HubSpot provisioned user by ID',
    inputSchema: deleteUserInputSchema,
    outputSchema: deleteUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/settings/users
      const params: Record<string, string> = {};
      if (input.idProperty) {
        params['idProperty'] = input.idProperty;
      }

      await platformProxy.delete({
        endpoint: `/settings/v3/users/${encodeURIComponent(input.userId)}`,
        params,
        retries: 3,
      });

      return {
        id: input.userId,
        deleted: true,
      };
    },
  });
}
