// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteRoleInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
  role_name: z.string().describe('The role name'),
});

const ProviderResponseSchema = z
  .object({
    role: z
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

export const deleteRoleOutputSchema = z.union([
  ProviderResponseSchema,
  z.object({ deleted: z.literal(true), already_absent: z.literal(true) }),
]);

export function deleteRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_delete_role',
    description:
      'Delete role. Deletes the specified Postgres role from the branch.\nFor related information, see [Manage roles](https://neon.com/docs/manage/roles/).\n',
    inputSchema: deleteRoleInputSchema,
    outputSchema: deleteRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/roles/${encodeURIComponent(input['role_name'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      if (response.status === 204) return { deleted: true, already_absent: true };
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
