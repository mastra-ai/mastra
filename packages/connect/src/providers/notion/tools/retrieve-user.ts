// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const retrieveUserInputSchema = z.object({
  user_id: z.string().describe('The ID of the user to retrieve. Example: "d42542a8-a81c-4386-aa95-313aa4e818b3"'),
});

export const retrieveUserOutputSchema = z.object({
  id: z.string(),
  object: z.string(),
  type: z.string(),
  name: z.string(),
  avatar_url: z.union([z.string(), z.null()]),
});

export function retrieveUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_user',
    description: 'Gets a single user by their ID.',
    inputSchema: retrieveUserInputSchema,
    outputSchema: retrieveUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrieveUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/get-user
        endpoint: `v1/users/${input.user_id}`,
        retries: 3,
      };

      const response = await platformProxy.get(config);
      const data = response.data;

      return {
        id: data.id,
        object: data.object,
        type: data.type,
        name: data.name,
        avatar_url: data.avatar_url ?? null,
      };
    },
  });
}
