// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getProjectInputSchema = z.object({ project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')) });

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
  })
  .passthrough();

export const getProjectOutputSchema = ProviderResponseSchema;

export function getProjectTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_project',
    description: 'Get project in Neon.',
    inputSchema: getProjectInputSchema,
    outputSchema: getProjectOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getProjectOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
