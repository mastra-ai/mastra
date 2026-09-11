// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getBranchInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')),
});

const ProviderResponseSchema = z
  .object({
    branch: z
      .object({
        id: z.string(),
        project_id: z.string(),
        parent_id: z.string().optional(),
        parent_lsn: z.string().optional(),
        parent_timestamp: z.string().optional(),
        name: z.string(),
        current_state: z.string(),
        pending_state: z.string().optional(),
        state_changed_at: z.string(),
        logical_size: z.number().int().optional(),
        creation_source: z.string(),
        primary: z.boolean().optional(),
        default: z.boolean(),
        protected: z.boolean(),
        cpu_used_sec: z.number().int(),
        compute_time_seconds: z.number().int(),
        active_time_seconds: z.number().int(),
        written_data_bytes: z.number().int(),
        data_transfer_bytes: z.number().int(),
        created_at: z.string(),
        updated_at: z.string(),
        ttl_interval_seconds: z.number().int().optional(),
        expires_at: z.string().optional(),
        last_reset_at: z.string().optional(),
        created_by: z.object({ name: z.string().optional(), image: z.string().optional() }).passthrough().optional(),
        init_source: z.string().optional(),
        restore_status: z.string().optional(),
        restored_from: z.string().optional(),
        restored_as: z.string().optional(),
        restricted_actions: z.array(z.object({ name: z.string(), reason: z.string() }).passthrough()).optional(),
        recovery: z
          .object({ deleted_at: z.string(), recoverable_until: z.string(), deletion_method: z.enum(['user', 'ttl']) })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    annotation: z
      .object({
        object: z.object({ type: z.string(), id: z.string() }).passthrough(),
        value: z.object({}).catchall(z.string()),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const getBranchOutputSchema = ProviderResponseSchema;

export function getBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_branch',
    description: 'Get branch in Neon.',
    inputSchema: getBranchInputSchema,
    outputSchema: getBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
