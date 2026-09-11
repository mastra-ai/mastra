// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getRoleInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
  role_name: z.string().describe('The role name'),
});

const ProviderResponseSchema = z
  .object({
    role: z
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
  })
  .passthrough();

export const getRoleOutputSchema = ProviderResponseSchema;

export function getRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_role',
    description:
      'Retrieve role details. Retrieves details about the specified role.\nIn Neon, the terms "role" and "user" are synonymous.\nFor related information, see [Manage roles](https://neon.com/docs/manage/roles/).\n',
    inputSchema: getRoleInputSchema,
    outputSchema: getRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/roles/${encodeURIComponent(input['role_name'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
