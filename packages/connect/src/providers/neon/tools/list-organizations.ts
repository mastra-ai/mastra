// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listOrganizationsInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    organizations: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          handle: z.string(),
          plan: z.string(),
          created_at: z.string(),
          managed_by: z.string(),
          updated_at: z.string(),
          allow_hipaa_projects: z.boolean().optional(),
          require_mfa: z.boolean().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listOrganizationsOutputSchema = ProviderResponseSchema;

export function listOrganizationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_organizations',
    description:
      'List organizations for the current user. Retrieves the organizations that the currently authenticated user belongs to.\n\nWhen called with an organization- or project-scoped API key (which is not\ntied to a user), this returns the single organization that owns the key.\n',
    inputSchema: listOrganizationsInputSchema,
    outputSchema: listOrganizationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOrganizationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/users/me/organizations`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
