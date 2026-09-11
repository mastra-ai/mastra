// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listBranchEndpointsInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
});

const ProviderResponseSchema = z
  .object({
    endpoints: z.array(
      z
        .object({
          host: z.string(),
          id: z.string(),
          name: z.string().optional(),
          project_id: z.string(),
          branch_id: z.string(),
          autoscaling_limit_min_cu: z.number().min(0.25),
          autoscaling_limit_max_cu: z.number().min(0.25),
          region_id: z.string(),
          type: z.enum(['read_only', 'read_write']),
          current_state: z.enum(['init', 'active', 'idle']),
          pending_state: z.enum(['init', 'active', 'idle']).optional(),
          settings: z
            .object({
              pg_settings: z.object({}).catchall(z.string()).optional(),
              pgbouncer_settings: z.object({}).catchall(z.string()).optional(),
              preload_libraries: z
                .object({ use_defaults: z.boolean().optional(), enabled_libraries: z.array(z.string()).optional() })
                .passthrough()
                .optional(),
            })
            .passthrough(),
          pooler_enabled: z.boolean(),
          pooler_mode: z.enum(['transaction']),
          disabled: z.boolean(),
          passwordless_access: z.boolean(),
          last_active: z.string().optional(),
          creation_source: z.string(),
          created_at: z.string(),
          updated_at: z.string(),
          started_at: z.string().optional(),
          suspended_at: z.string().optional(),
          proxy_host: z.string(),
          suspend_timeout_seconds: z.number().int().min(-1).max(604800),
          provisioner: z.string(),
          compute_release_version: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listBranchEndpointsOutputSchema = ProviderResponseSchema;

export function listBranchEndpointsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_branch_endpoints',
    description:
      'List branch endpoints. Retrieves a list of compute endpoints for the specified branch.\nNeon permits only one read-write compute endpoint per branch.\nA branch can have multiple read-only compute endpoints.\n',
    inputSchema: listBranchEndpointsInputSchema,
    outputSchema: listBranchEndpointsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBranchEndpointsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/endpoints`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
