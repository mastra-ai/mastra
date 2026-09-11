// AUTO-GENERATED from rhysbalevicius/integration-templates @ 15123cf72c67 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getDatabaseInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
  database_name: z.string().describe('The database name'),
});

const ProviderResponseSchema = z
  .object({
    database: z
      .object({
        id: z.number().int(),
        branch_id: z.string(),
        name: z.string(),
        owner_name: z.string(),
        created_at: z.string(),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getDatabaseOutputSchema = ProviderResponseSchema;

export function getDatabaseTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_database',
    description:
      'Retrieve database details. Retrieves information about the specified database.\nFor related information, see [Manage databases](https://neon.com/docs/manage/databases/).\n',
    inputSchema: getDatabaseInputSchema,
    outputSchema: getDatabaseOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDatabaseOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/databases/${encodeURIComponent(input['database_name'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
