// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const fetchRolesInputSchema = z.object({});

const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  requiresBillingWrite: z.boolean(),
});

export const fetchRolesOutputSchema = z.object({
  roles: z.array(RoleSchema),
});

export function fetchRolesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_fetch_roles',
    description: 'List available user roles for a HubSpot enterprise account',
    inputSchema: fetchRolesInputSchema,
    outputSchema: fetchRolesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof fetchRolesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/settings-user-provisioning-v3/roles/get-settings-v3-users-roles
      const response = await platformProxy.get({
        endpoint: '/settings/v3/users/roles',
        retries: 3,
      });

      const data = response.data;

      return {
        roles:
          data.results?.map((role: any) => ({
            id: role.id,
            name: role.name,
            requiresBillingWrite: role.requiresBillingWrite ?? false,
          })) ?? [],
      };
    },
  });
}
