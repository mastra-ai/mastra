// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listDatabasesInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')),
});

const ProviderResponseSchema = z
  .object({
    databases: z.array(
      z
        .object({
          id: z.number().int(),
          branch_id: z.string(),
          name: z.string(),
          owner_name: z.string(),
          created_at: z.string(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listDatabasesOutputSchema = ProviderResponseSchema;

export function listDatabasesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_databases',
    description: 'List databases in Neon.',
    inputSchema: listDatabasesInputSchema,
    outputSchema: listDatabasesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDatabasesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/databases`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
