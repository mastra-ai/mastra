// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getCurrentUserInputSchema = z.object({});

export const getCurrentUserOutputSchema = z.object({
  id: z.string(),
  email: z.string(),
  handle: z.string(),
  img_url: z.string().optional(),
});

export function getCurrentUserTool(proxy: PlatformProxy) {
  return createTool({
    id: 'figma_get_current_user',
    description: 'Fetch the current Figma user.',
    inputSchema: getCurrentUserInputSchema,
    outputSchema: getCurrentUserOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCurrentUserOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://www.figma.com/developers/api#get-me-endpoint
        endpoint: '/v1/me',
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const providerUser = z
        .object({
          id: z.string(),
          email: z.string(),
          handle: z.string(),
          img_url: z.string().optional(),
        })
        .parse(response.data);

      return {
        id: providerUser.id,
        email: providerUser.email,
        handle: providerUser.handle,
        ...(providerUser.img_url !== undefined && { img_url: providerUser.img_url }),
      };
    },
  });
}
