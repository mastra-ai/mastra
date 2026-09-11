// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const restoreSnapshotInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  snapshot_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The snapshot ID'),
  name: z
    .string()
    .describe(
      'Deprecated. Use the `name` field in the request body instead. Removal scheduled for November 29, 2025.\nA name for the newly restored branch. If omitted, a default name will be generated.\n',
    )
    .optional(),
  body: z
    .object({
      name: z
        .string()
        .describe(
          'A name for the newly restored branch. If not provided, the server generates a unique name for the branch automatically.\n',
        )
        .optional(),
      target_branch_id: z
        .string()
        .describe(
          "ID of the branch to restore the snapshot into. Defaults to the snapshot's source branch (`snapshot.source_branch_id`); fails if that cannot be determined.\n",
        )
        .optional(),
      finalize_restore: z
        .boolean()
        .describe(
          'Set to `true` to finalize the restore operation immediately.\nThis will complete the restore and move any associated computes to the new branch,\nsimilar to the `finalizeRestoreBranch` operation.\nDefaults to `false` to allow previewing the restored snapshot data first.\n',
        )
        .optional(),
    })
    .optional(),
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
    endpoints: z
      .array(
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
      )
      .optional(),
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

export const restoreSnapshotOutputSchema = ProviderResponseSchema;

export function restoreSnapshotTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_restore_snapshot',
    description:
      'Restore snapshot. Restores the specified snapshot to a new branch,\nand optionally finalizes the restore operation to replace the original branch.\n',
    inputSchema: restoreSnapshotInputSchema,
    outputSchema: restoreSnapshotOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof restoreSnapshotOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['name'] !== undefined) params['name'] = input['name'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/snapshots/${encodeURIComponent(input['snapshot_id'])}/restore`,
        retries: 0,
        params,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
