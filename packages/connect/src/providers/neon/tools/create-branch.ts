// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createBranchInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')),
  body: z.object({
    endpoints: z
      .array(
        z.object({
          type: z.enum(['read_only', 'read_write']),
          settings: z
            .object({
              pg_settings: z.object({}).catchall(z.string()).optional(),
              pgbouncer_settings: z.object({}).catchall(z.string()).optional(),
              preload_libraries: z
                .object({ use_defaults: z.boolean().optional(), enabled_libraries: z.array(z.string()).optional() })
                .optional(),
            })
            .optional(),
          autoscaling_limit_min_cu: z.number().min(0.25).optional(),
          autoscaling_limit_max_cu: z.number().min(0.25).optional(),
          provisioner: z.string().optional(),
          suspend_timeout_seconds: z.number().int().min(-1).max(604800).optional(),
        }),
      )
      .optional(),
    branch: z
      .object({
        parent_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).optional(),
        name: z.string().min(1).max(256).optional(),
        parent_lsn: z.string().optional(),
        parent_timestamp: z.string().optional(),
        protected: z.boolean().optional(),
        archived: z.boolean().optional(),
        init_source: z.string().optional(),
        expires_at: z.string().optional(),
      })
      .optional(),
    annotation_value: z.object({}).catchall(z.string()).optional(),
  }),
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
    roles: z.array(
      z
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
    ),
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
    connection_uris: z
      .array(
        z
          .object({
            connection_uri: z.string(),
            connection_parameters: z
              .object({
                database: z.string(),
                password: z.string(),
                role: z.string(),
                host: z.string(),
                pooler_host: z.string(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const createBranchOutputSchema = ProviderResponseSchema;

export function createBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_create_branch',
    description: 'Create branch in Neon.',
    inputSchema: createBranchInputSchema,
    outputSchema: createBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
