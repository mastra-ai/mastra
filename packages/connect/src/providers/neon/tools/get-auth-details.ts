// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getAuthDetailsInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    account_id: z.string(),
    auth_method: z.enum(['keycloak', 'session_cookie', 'api_key_user', 'api_key_org', 'oauth']),
    auth_data: z.string().optional(),
  })
  .passthrough();

export const getAuthDetailsOutputSchema = ProviderResponseSchema;

export function getAuthDetailsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_auth_details',
    description:
      'Retrieve request authentication details. Returns authentication details for the credentials used in the request,\nincluding the credential type (API key, Bearer token, or OAuth session)\nand the associated identity.\n',
    inputSchema: getAuthDetailsInputSchema,
    outputSchema: getAuthDetailsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAuthDetailsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/auth`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
