// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const restartEndpointInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  endpoint_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The endpoint ID'),
});

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

export const restartEndpointOutputSchema = ProviderResponseSchema;

export function restartEndpointTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_restart_endpoint',
    description:
      'Restart compute endpoint. Restarts the specified compute endpoint by immediately suspending it and then starting it again.\nAn `endpoint_id` has an `ep-` prefix.\nFor information about compute endpoints, see [Manage computes](https://neon.com/docs/manage/endpoints/).\n',
    inputSchema: restartEndpointInputSchema,
    outputSchema: restartEndpointOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof restartEndpointOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/endpoints/${encodeURIComponent(input['endpoint_id'])}/restart`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
