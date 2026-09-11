// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listBranchesInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')),
  search: z.string().optional(),
  sort_by: z.enum(['name', 'created_at', 'updated_at']).optional(),
  cursor: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  include_deleted: z.boolean().optional(),
});

const ProviderResponseSchema = z
  .object({
    branches: z.array(
      z
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
    ),
    annotations: z.object({}).catchall(
      z
        .object({
          object: z.object({ type: z.string(), id: z.string() }).passthrough(),
          value: z.object({}).catchall(z.string()),
          created_at: z.string().optional(),
          updated_at: z.string().optional(),
        })
        .passthrough(),
    ),
    pagination: z
      .object({ next: z.string().optional(), sort_by: z.string().optional(), sort_order: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const listBranchesOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listBranchesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_branches',
    description: 'List branches in Neon. Returns one page; pass next_cursor as cursor to continue.',
    inputSchema: listBranchesInputSchema,
    outputSchema: listBranchesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listBranchesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['search'] !== undefined) params['search'] = input['search'];
      if (input['sort_by'] !== undefined) params['sort_by'] = input['sort_by'];
      if (input['cursor'] !== undefined) params['cursor'] = input['cursor'];
      if (input['sort_order'] !== undefined) params['sort_order'] = input['sort_order'];
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      if (input['include_deleted'] !== undefined) params['include_deleted'] = String(input['include_deleted']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination?.next || undefined };
    },
  });
}
