// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listRolesInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
});

const ProviderResponseSchema = z
  .object({
    roles: z.array(
      z
        .object({
          branch_id: z.string(),
          name: z.string(),
          password: z.string().optional(),
          protected: z.boolean().optional(),
          authentication_method: z.string().optional(),
          created_at: z.string(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listRolesOutputSchema = ProviderResponseSchema;

export function listRolesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_roles',
    description:
      'List roles. Retrieves a list of Postgres roles from the specified branch.\nFor related information, see [Manage roles](https://neon.com/docs/manage/roles/).\n',
    inputSchema: listRolesInputSchema,
    outputSchema: listRolesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRolesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/roles`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
