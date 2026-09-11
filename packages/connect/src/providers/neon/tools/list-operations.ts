// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3e5c6ed7617f — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listOperationsInputSchema = z.object({
  cursor: z
    .string()
    .describe('Specify the cursor value from the previous response to get the next batch of operations')
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe('Specify a value from 1 to 1000 to limit number of operations in the response')
    .optional(),
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
});

const ProviderResponseSchema = z
  .object({
    operations: z.array(
      z
        .object({
          id: z.string(),
          project_id: z.string(),
          branch_id: z.string().optional(),
          endpoint_id: z.string().optional(),
          action: z.enum([
            'create_compute',
            'create_timeline',
            'start_compute',
            'suspend_compute',
            'apply_config',
            'check_availability',
            'delete_timeline',
            'create_branch',
            'import_data',
            'tenant_ignore',
            'tenant_attach',
            'tenant_detach',
            'tenant_detach_safekeepers',
            'tenant_attach_safekeepers',
            'tenant_reattach',
            'replace_safekeeper',
            'disable_maintenance',
            'apply_storage_config',
            'prepare_secondary_pageserver',
            'switch_pageserver',
            'detach_parent_branch',
            'timeline_archive',
            'timeline_unarchive',
            'start_reserved_compute',
            'sync_dbs_and_roles_from_compute',
            'apply_schema_from_branch',
            'timeline_mark_invisible',
            'timeline_update_protected_config',
            'prewarm_replica',
            'promote_replica',
            'set_storage_non_dirty',
            'swap_binding_id',
            'finalize_migration',
            'mark_migration_prepared',
            'update_catalog',
            'epc_sync',
          ]),
          status: z.enum([
            'scheduling',
            'running',
            'finished',
            'failed',
            'error',
            'cancelling',
            'cancelled',
            'skipped',
          ]),
          error: z.string().optional(),
          failures_count: z.number().int(),
          retry_at: z.string().optional(),
          created_at: z.string(),
          updated_at: z.string(),
          total_duration_ms: z.number().int(),
        })
        .passthrough(),
    ),
    pagination: z
      .object({ cursor: z.string().min(1) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const listOperationsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listOperationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_operations',
    description:
      'List operations. Retrieves a list of operations for the specified Neon project.\nThe number of operations returned can be large.\nTo paginate the response, issue an initial request with a `limit` value.\nThen, add the `cursor` value that was returned in the response to the next request.\nOperations older than 6 months may be deleted from our systems.\nIf you need more history than that, you should store your own history.\n Returns one page; pass next_cursor as cursor to continue.',
    inputSchema: listOperationsInputSchema,
    outputSchema: listOperationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOperationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['cursor'] !== undefined) params['cursor'] = input['cursor'];
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/operations`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination?.cursor || undefined };
    },
  });
}
