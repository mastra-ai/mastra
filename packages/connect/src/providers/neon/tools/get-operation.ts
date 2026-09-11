// AUTO-GENERATED from rhysbalevicius/integration-templates @ 7c94e2fbfccf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getOperationInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  operation_id: z.string().uuid().describe('The operation ID'),
});

const ProviderResponseSchema = z
  .object({
    operation: z
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
        status: z.enum(['scheduling', 'running', 'finished', 'failed', 'error', 'cancelling', 'cancelled', 'skipped']),
        error: z.string().optional(),
        failures_count: z.number().int(),
        retry_at: z.string().optional(),
        created_at: z.string(),
        updated_at: z.string(),
        total_duration_ms: z.number().int(),
      })
      .passthrough(),
  })
  .passthrough();

export const getOperationOutputSchema = ProviderResponseSchema;

export function getOperationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_operation',
    description:
      'Retrieve operation details. Retrieves details for the specified operation.\nAn operation is an action performed on a Neon project resource.\n',
    inputSchema: getOperationInputSchema,
    outputSchema: getOperationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOperationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/operations/${encodeURIComponent(input['operation_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
