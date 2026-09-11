// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const finalizeRestoreBranchInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
  body: z
    .object({
      name: z.string().describe('Name for the replaced branch. If omitted, a unique name is generated.').optional(),
    })
    .optional(),
});

const ProviderResponseSchema = z
  .object({
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

export const finalizeRestoreBranchOutputSchema = ProviderResponseSchema;

export function finalizeRestoreBranchTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_finalize_restore_branch',
    description:
      "Finalize branch restore from snapshot. Finalize the restore operation for a branch created from a snapshot.\nThis operation updates the branch so it functions as the original branch it replaced.\nThis includes:\n  - Reassigning any computes from the original branch to the restored branch (this will restart the computes)\n  - Renaming the restored branch to the original branch's name\n  - Renaming the original branch so it no longer uses the original name\n\nThis operation only applies to branches created using the `restoreSnapshot` endpoint with `finalize_restore: false`.\n",
    inputSchema: finalizeRestoreBranchInputSchema,
    outputSchema: finalizeRestoreBranchOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof finalizeRestoreBranchOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/finalize_restore`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
