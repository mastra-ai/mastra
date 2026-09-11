// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3e5c6ed7617f — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateProjectInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  body: z.object({
    project: z.object({
      settings: z
        .object({
          quota: z
            .object({
              active_time_seconds: z
                .number()
                .int()
                .min(0)
                .describe(
                  "The total amount of wall-clock time allowed to be spent by the project's compute endpoints.\n",
                )
                .optional(),
              compute_time_seconds: z
                .number()
                .int()
                .min(0)
                .describe("The total amount of CPU seconds allowed to be spent by the project's compute endpoints.\n")
                .optional(),
              written_data_bytes: z
                .number()
                .int()
                .min(0)
                .describe("Total amount of data written to all of a project's branches.\n")
                .optional(),
              data_transfer_bytes: z
                .number()
                .int()
                .min(0)
                .describe("Total amount of data transferred from all of a project's branches using the proxy.\n")
                .optional(),
              logical_size_bytes: z
                .number()
                .int()
                .min(0)
                .describe(
                  "Limit on the logical size of every project's branch.\n\nIf a branch exceeds its `logical_size_bytes` quota, computes can still be started,\nbut write operations will fail—allowing data to be deleted to free up space.\nComputes on other branches are not affected.\n\nSetting `logical_size_bytes` overrides any lower value set by the `neon.max_cluster_size` Postgres setting.\n",
                )
                .optional(),
            })
            .describe(
              'Per-project consumption quotas. If a quota is exceeded, all active computes\nare automatically suspended and cannot be started via API calls or incoming connections.\n\nThe exception is `logical_size_bytes`, which is enforced per branch.\nIf a branch exceeds its `logical_size_bytes` quota, computes can still be started,\nbut write operations will fail—allowing data to be deleted to free up space.\nComputes on other branches are not affected.\n\nSetting `logical_size_bytes` overrides any lower value set by the `neon.max_cluster_size` Postgres setting.\n\nQuotas are enforced using per-project consumption metrics with the same names.\nThese metrics reset at the start of each billing period. `logical_size_bytes`\nis also an exception—it reflects the total data stored in a branch and does not reset.\n\nA zero or empty quota value means “unlimited.”\n',
            )
            .optional(),
          allowed_ips: z
            .object({
              ips: z
                .array(z.string())
                .describe('A list of IP addresses that are allowed to connect to the endpoint.')
                .optional(),
              protected_branches_only: z
                .boolean()
                .describe('If true, the list will be applied only to protected branches.')
                .optional(),
            })
            .describe(
              'A list of IP addresses that are allowed to connect to the compute endpoint.\nIf the list is empty or not set, all IP addresses are allowed.\nIf protected_branches_only is true, the list will be applied only to protected branches.\n',
            )
            .optional(),
          enable_logical_replication: z
            .boolean()
            .describe(
              'Sets wal_level=logical for all compute endpoints in this project.\nAll active endpoints will be suspended.\nOnce enabled, logical replication cannot be disabled.\n',
            )
            .optional(),
          maintenance_window: z
            .object({
              weekdays: z
                .array(z.number().int())
                .describe(
                  'A list of weekdays when the maintenance window is active.\nEncoded as ints, where 1 - Monday, and 7 - Sunday.\n',
                ),
              start_time: z
                .string()
                .describe('Start time of the maintenance window, in the format of "HH:MM". Uses UTC.\n'),
              end_time: z
                .string()
                .describe('End time of the maintenance window, in the format of "HH:MM". Uses UTC.\n'),
            })
            .describe(
              "A maintenance window is a time period during which Neon may perform maintenance on the project's infrastructure.\nDuring this time, the project's compute endpoints may be unavailable and existing connections can be\ninterrupted.\n",
            )
            .optional(),
          block_public_connections: z
            .boolean()
            .describe(
              'When set, connections from the public internet\nare disallowed. This supersedes the AllowedIPs list.\nThis parameter is under active development and its semantics may change in the future.\n',
            )
            .optional(),
          block_vpc_connections: z
            .boolean()
            .describe(
              'When set, connections using VPC endpoints are disallowed.\nThis parameter is under active development and its semantics may change in the future.\n',
            )
            .optional(),
          audit_log_level: z
            .enum(['base', 'extended', 'full'])
            .describe(
              'Audit logging level, set only on HIPAA-enabled organizations (absent otherwise). Values: `base`, `extended`, `full`; HIPAA defaults to `extended`. Cannot be lowered back to `base` once `extended` or `full`.',
            )
            .optional(),
          hipaa: z
            .boolean()
            .describe('Enables HIPAA compliance mode for the project, including audit logging.')
            .optional(),
          preload_libraries: z
            .object({
              use_defaults: z
                .boolean()
                .describe(
                  "When true, the project's preload libraries include the platform default set in addition to any libraries listed in `enabled_libraries`.",
                )
                .optional(),
              enabled_libraries: z
                .array(z.string())
                .describe('Names of shared preload libraries to enable for the project.')
                .optional(),
            })
            .describe("The shared libraries to preload into the project's compute instances.\n")
            .optional(),
        })
        .describe(
          'Project-level settings, for example `quota`, `allowed_ips`, `enable_logical_replication`, and `maintenance_window`.',
        )
        .optional(),
      name: z.string().min(1).max(256).describe('The project name').optional(),
      default_endpoint_settings: z
        .object({
          pg_settings: z
            .object({})
            .catchall(z.string())
            .describe('A raw representation of Postgres settings')
            .optional(),
          pgbouncer_settings: z
            .object({})
            .catchall(z.string())
            .describe(
              'Deprecated. Use the endpoint-level connection pooler configuration instead. Removal scheduled for June 20, 2026.\n',
            )
            .optional(),
          autoscaling_limit_min_cu: z
            .number()
            .min(0.25)
            .describe(
              'Minimum number of Compute Units for this endpoint. At least 0.25 and no greater than `autoscaling_limit_max_cu`.\n',
            )
            .optional(),
          autoscaling_limit_max_cu: z
            .number()
            .min(0.25)
            .describe(
              'Default maximum number of Compute Units for endpoints created under this account. At least 0.25.\n',
            )
            .optional(),
          suspend_timeout_seconds: z
            .number()
            .int()
            .min(-1)
            .max(604800)
            .describe(
              'Scale-to-zero idle timeout, in seconds, before the compute suspends. `0` uses the plan default; `-1` disables scale-to-zero (never suspends). Minimum is plan-dependent (Scale: 60); maximum 604800 (one week). Free cannot change it; Launch can only enable or disable; Scale can set any value.',
            )
            .optional(),
        })
        .describe('A collection of settings for a Neon endpoint')
        .optional(),
      history_retention_seconds: z
        .number()
        .int()
        .min(0)
        .max(2592000)
        .describe(
          'History window (point-in-time restore range) for all branches, in seconds. `0` disables it. Default 1 day (Free: 6 hours). Maximum depends on plan: Free 6 hours (21600), Launch 7 days (604800), Scale 30 days (2592000).\n',
        )
        .optional(),
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

export const updateProjectOutputSchema = ProviderResponseSchema;

export function updateProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_update_project',
    description:
      'Update project. Updates the specified project.\nConfigurable properties include the project name, default compute settings, history retention period, and IP allowlist.\n',
    inputSchema: updateProjectInputSchema,
    outputSchema: updateProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
