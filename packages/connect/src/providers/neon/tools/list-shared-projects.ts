// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3e5c6ed7617f — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listSharedProjectsInputSchema = z.object({
  cursor: z
    .string()
    .describe('Specify the cursor value from the previous response to get the next batch of projects.')
    .optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(400)
    .describe('Specify a value from 1 to 400 to limit number of projects in the response.')
    .optional(),
  search: z.string().describe('Search query by name or id.').optional(),
  timeout: z
    .number()
    .int()
    .min(100)
    .max(30000)
    .describe(
      'Specify an explicit timeout in milliseconds to limit response delay.\nAfter timing out, the incomplete list of project data fetched so far will be returned.\nProjects still being fetched when the timeout occurred are listed in the "unavailable" attribute of the response.\nIf not specified, an implicit implementation defined timeout is chosen with the same behaviour as above\n',
    )
    .optional(),
});

const ProviderResponseSchema = z
  .object({
    projects: z.array(
      z
        .object({
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
          active_time: z.number().int().min(0),
          cpu_used_sec: z.number().int(),
          maintenance_starts_at: z.string().optional(),
          creation_source: z.string(),
          created_at: z.string(),
          updated_at: z.string(),
          synthetic_storage_size: z.number().int().optional(),
          quota_reset_at: z.string().optional(),
          owner_id: z.string(),
          compute_last_active_at: z.string().optional(),
          org_id: z.string().optional(),
          org_name: z.string().optional(),
          history_retention_seconds: z.number().int().optional(),
          hipaa_enabled_at: z.string().optional(),
          deleted_at: z.string().optional(),
          recoverable_until: z.string().optional(),
          effective_project_permission: z.enum(['VIEWER', 'EDITOR', 'ADMIN']).nullable().optional(),
        })
        .passthrough(),
    ),
    unavailable_project_ids: z.array(z.string()).optional(),
    pagination: z
      .object({ cursor: z.string().min(1) })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const listSharedProjectsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listSharedProjectsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_shared_projects',
    description:
      'List shared projects. Retrieves a list of projects shared with your Neon account.\nFor more information, see [Manage projects](https://neon.com/docs/manage/projects/).\n Returns one page; pass next_cursor as cursor to continue.',
    inputSchema: listSharedProjectsInputSchema,
    outputSchema: listSharedProjectsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSharedProjectsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['cursor'] !== undefined) params['cursor'] = input['cursor'];
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      if (input['search'] !== undefined) params['search'] = input['search'];
      if (input['timeout'] !== undefined) params['timeout'] = input['timeout'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/shared`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination?.cursor || undefined };
    },
  });
}
