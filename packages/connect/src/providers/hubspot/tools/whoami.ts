// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const whoamiInputSchema = z.object({});

export const whoamiOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  hubId: z.number(),
  hubDomain: z.string().optional(),
});

export function whoamiTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_whoami',
    description: "Retrieve the current authenticated HubSpot user's ID and email",
    inputSchema: whoamiInputSchema,
    outputSchema: whoamiOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof whoamiOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/legacy/oauth-v1/get-oauth-v1-access-tokens-token
      // First, get the connection to access the access token
      const connection = await platformProxy.getConnectionWithCredentials();

      if (!connection.credentials || typeof connection.credentials !== 'object') {
        throw new platformProxy.ActionError({
          type: 'missing_credentials',
          message: 'Connection credentials are missing or invalid',
        });
      }

      let accessToken: string;
      if ('access_token' in connection.credentials && typeof connection.credentials.access_token === 'string') {
        accessToken = connection.credentials.access_token;
      } else {
        throw new platformProxy.ActionError({
          type: 'missing_token',
          message: 'Access token not found in connection',
        });
      }

      const response = await platformProxy.get({
        endpoint: `/oauth/v1/access-tokens/${accessToken}`,
        retries: 3,
      });

      const data = response.data;

      return {
        id: String(data.user_id),
        email: data.user,
        hubId: data.hub_id,
        hubDomain: data.hub_domain ?? undefined,
      };
    },
  });
}
