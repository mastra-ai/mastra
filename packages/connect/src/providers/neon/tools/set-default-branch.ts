// AUTO-GENERATED from rhysbalevicius/integration-templates @ 7c94e2fbfccf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const setDefaultBranchInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
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
  })
  .passthrough();

export const setDefaultBranchOutputSchema = ProviderResponseSchema;

export function setDefaultBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_set_default_branch',
    description:
      "Set branch as default. Sets the specified branch as the project's default branch.\nThe default designation is automatically removed from the previous default branch.\nFor more information, see [Manage branches](https://neon.com/docs/manage/branches/).\n",
    inputSchema: setDefaultBranchInputSchema,
    outputSchema: setDefaultBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setDefaultBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/set_as_default`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
