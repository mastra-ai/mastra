// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2464f5a43eaa — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateEndpointInputSchema = z
  .object({
    project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
    endpoint_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The endpoint ID'),
    body: z.object({
      endpoint: z
        .object({
          branch_id: z
            .string()
            .regex(new RegExp('^[a-z0-9-]{1,60}$'))
            .describe('Deprecated. The destination branch ID; must not have an existing read-write endpoint.\n')
            .optional(),
          autoscaling_limit_min_cu: z
            .number()
            .min(0.25)
            .describe(
              'The minimum number of Compute Units. The minimum value is `0.25`.\nSee [Compute size and Autoscaling configuration](https://neon.com/docs/manage/endpoints#compute-size-and-autoscaling-configuration)\nfor more information.\n',
            )
            .optional(),
          autoscaling_limit_max_cu: z
            .number()
            .min(0.25)
            .describe(
              'The maximum number of Compute Units.\nSee [Compute size and Autoscaling configuration](https://neon.com/docs/manage/endpoints#compute-size-and-autoscaling-configuration)\nfor more information.\n',
            )
            .optional(),
          provisioner: z
            .string()
            .describe(
              'Compute provisioner. `k8s-neonvm` (default) supports Autoscaling; `k8s-pod` is fixed-size compute. Also `docker` and `serverless-platform`.',
            )
            .optional(),
          settings: z
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
                  'Deprecated. PgBouncer settings for the compute endpoint. Removal scheduled for June 20, 2026.\n',
                )
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
            .describe('A collection of settings for a compute endpoint')
            .optional(),
          pooler_enabled: z
            .boolean()
            .describe(
              'Deprecated. To enable connection pooling, append `-pooler` to the endpoint ID in the connection string.\nSee [How to use connection pooling](https://neon.com/docs/connect/connection-pooling#how-to-use-connection-pooling)\n',
            )
            .optional(),
          pooler_mode: z
            .enum(['transaction'])
            .describe('Deprecated. The connection pooler mode. Removal scheduled for June 20, 2026.\n')
            .optional(),
          disabled: z
            .boolean()
            .describe(
              'Whether to restrict connections to the compute endpoint.\nEnabling this option schedules a suspend compute operation.\nA disabled compute endpoint cannot be enabled by a connection or\nconsole action. However, the compute endpoint is periodically\nenabled by check_availability operations.\n',
            )
            .optional(),
          passwordless_access: z
            .boolean()
            .describe('NOT YET IMPLEMENTED. Whether to permit passwordless access to the compute endpoint.\n')
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
          name: z.string().min(1).max(64).describe('Optional name of the compute endpoint\n').optional(),
        })
        .describe('Parameters for the compute endpoint update.'),
    }),
  })
  .refine(
    input =>
      input.body.endpoint.autoscaling_limit_min_cu === undefined ||
      input.body.endpoint.autoscaling_limit_max_cu === undefined ||
      input.body.endpoint.autoscaling_limit_min_cu <= input.body.endpoint.autoscaling_limit_max_cu,
    { message: 'Minimum compute units must not exceed maximum', path: ['body', 'endpoint'] },
  );

const ProviderResponseSchema = z
  .object({
    endpoint: z
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

export const updateEndpointOutputSchema = ProviderResponseSchema;

export function updateEndpointTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_update_endpoint',
    description:
      'Update compute endpoint. Updates the specified compute endpoint.\n\nAn `endpoint_id` has an `ep-` prefix. A `branch_id` has a `br-` prefix.\nFor more information about compute endpoints, see [Manage computes](https://neon.com/docs/manage/endpoints/).\n\nIf the returned list of operations is not empty, the compute endpoint is not ready to use.\nThe client must wait for the last operation to finish before using the compute endpoint.\nIf the compute endpoint was idle before the update, it becomes active for a short period of time,\nand the control plane suspends it again after the update.\n',
    inputSchema: updateEndpointInputSchema,
    outputSchema: updateEndpointOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateEndpointOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/endpoints/${encodeURIComponent(input['endpoint_id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
