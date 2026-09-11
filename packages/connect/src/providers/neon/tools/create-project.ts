// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createProjectInputSchema = z.object({
  body: z.object({
    project: z.object({
      settings: z
        .object({
          quota: z
            .object({
              active_time_seconds: z.number().int().min(0).optional(),
              compute_time_seconds: z.number().int().min(0).optional(),
              written_data_bytes: z.number().int().min(0).optional(),
              data_transfer_bytes: z.number().int().min(0).optional(),
              logical_size_bytes: z.number().int().min(0).optional(),
            })
            .optional(),
          allowed_ips: z
            .object({ ips: z.array(z.string()).optional(), protected_branches_only: z.boolean().optional() })
            .optional(),
          enable_logical_replication: z.boolean().optional(),
          maintenance_window: z
            .object({ weekdays: z.array(z.number().int()), start_time: z.string(), end_time: z.string() })
            .optional(),
          block_public_connections: z.boolean().optional(),
          block_vpc_connections: z.boolean().optional(),
          audit_log_level: z.enum(['base', 'extended', 'full']).optional(),
          hipaa: z.boolean().optional(),
          preload_libraries: z
            .object({ use_defaults: z.boolean().optional(), enabled_libraries: z.array(z.string()).optional() })
            .optional(),
        })
        .optional(),
      name: z.string().min(1).max(256).optional(),
      branch: z
        .object({
          name: z.string().min(1).max(256).optional(),
          role_name: z.string().optional(),
          database_name: z.string().optional(),
          annotations: z.object({}).catchall(z.string()).optional(),
        })
        .optional(),
      autoscaling_limit_min_cu: z.number().min(0.25).optional(),
      autoscaling_limit_max_cu: z.number().min(0.25).optional(),
      provisioner: z.string().optional(),
      region_id: z.string().optional(),
      default_endpoint_settings: z
        .object({
          pg_settings: z.object({}).catchall(z.string()).optional(),
          pgbouncer_settings: z.object({}).catchall(z.string()).optional(),
          autoscaling_limit_min_cu: z.number().min(0.25).optional(),
          autoscaling_limit_max_cu: z.number().min(0.25).optional(),
          suspend_timeout_seconds: z.number().int().min(-1).max(604800).optional(),
        })
        .optional(),
      pg_version: z.number().int().min(14).max(19).optional(),
      store_passwords: z.boolean().optional(),
      history_retention_seconds: z.number().int().min(0).max(2592000).optional(),
      org_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).optional(),
    }),
  }),
});

const ProviderResponseSchema = z
  .object({
    project: z
      .object({
        data_storage_bytes_hour: z.number().int().min(0),
        data_transfer_bytes: z.number().int().min(0),
        written_data_bytes: z.number().int().min(0),
        compute_time_seconds: z.number().int().min(0),
        active_time_seconds: z.number().int().min(0),
        cpu_used_sec: z.number().int(),
        id: z.string(),
        platform_id: z.string(),
        region_id: z.string(),
        name: z.string(),
        provisioner: z.string(),
        default_endpoint_settings: z
          .object({
            pg_settings: z.object({}).catchall(z.string()).optional(),
            pgbouncer_settings: z.object({}).catchall(z.string()).optional(),
            autoscaling_limit_min_cu: z.number().min(0.25).optional(),
            autoscaling_limit_max_cu: z.number().min(0.25).optional(),
            suspend_timeout_seconds: z.number().int().min(-1).max(604800).optional(),
          })
          .passthrough()
          .optional(),
        settings: z
          .object({
            quota: z
              .object({
                active_time_seconds: z.number().int().min(0).optional(),
                compute_time_seconds: z.number().int().min(0).optional(),
                written_data_bytes: z.number().int().min(0).optional(),
                data_transfer_bytes: z.number().int().min(0).optional(),
                logical_size_bytes: z.number().int().min(0).optional(),
              })
              .passthrough()
              .optional(),
            allowed_ips: z
              .object({ ips: z.array(z.string()).optional(), protected_branches_only: z.boolean().optional() })
              .passthrough()
              .optional(),
            enable_logical_replication: z.boolean().optional(),
            maintenance_window: z
              .object({ weekdays: z.array(z.number().int()), start_time: z.string(), end_time: z.string() })
              .passthrough()
              .optional(),
            block_public_connections: z.boolean().optional(),
            block_vpc_connections: z.boolean().optional(),
            audit_log_level: z.enum(['base', 'extended', 'full']).optional(),
            hipaa: z.boolean().optional(),
            preload_libraries: z
              .object({ use_defaults: z.boolean().optional(), enabled_libraries: z.array(z.string()).optional() })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
        pg_version: z.number().int().min(14).max(19),
        proxy_host: z.string(),
        branch_logical_size_limit: z.number().int(),
        branch_logical_size_limit_bytes: z.number().int(),
        store_passwords: z.boolean(),
        maintenance_starts_at: z.string().optional(),
        creation_source: z.string(),
        history_retention_seconds: z.number().int(),
        created_at: z.string(),
        updated_at: z.string(),
        synthetic_storage_size: z.number().int().optional(),
        consumption_period_start: z.string(),
        consumption_period_end: z.string(),
        quota_reset_at: z.string().optional(),
        owner_id: z.string(),
        owner: z
          .object({
            email: z.string().min(1).max(256),
            name: z.string(),
            branches_limit: z.number().int(),
            subscription_type: z.enum([
              'UNKNOWN',
              'direct_sales',
              'direct_sales_v3',
              'aws_marketplace',
              'free_v2',
              'free_v3',
              'launch',
              'launch_v3',
              'scale',
              'scale_v3',
              'business',
              'vercel_pg_legacy',
            ]),
          })
          .passthrough()
          .optional(),
        compute_last_active_at: z.string().optional(),
        org_id: z.string().optional(),
        maintenance_scheduled_for: z.string().optional(),
        hipaa_enabled_at: z.string().optional(),
        effective_project_permission: z.enum(['VIEWER', 'EDITOR', 'ADMIN']).nullable().optional(),
      })
      .passthrough(),
    connection_uris: z.array(
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
  })
  .passthrough();

export const createProjectOutputSchema = ProviderResponseSchema;

export function createProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_create_project',
    description: 'Create project in Neon.',
    inputSchema: createProjectInputSchema,
    outputSchema: createProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
