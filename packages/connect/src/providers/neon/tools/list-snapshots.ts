// AUTO-GENERATED from rhysbalevicius/integration-templates @ 4cdd3a76deb0 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listSnapshotsInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
});

const ProviderResponseSchema = z
  .object({
    snapshots: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          lsn: z.string().optional(),
          timestamp: z.string().optional(),
          source_branch_id: z.string().optional(),
          created_at: z.string(),
          expires_at: z.string().optional(),
          manual: z.boolean().optional(),
          full_size: z.number().int().optional(),
          diff_size: z.number().int().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listSnapshotsOutputSchema = ProviderResponseSchema;

export function listSnapshotsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_snapshots',
    description:
      'List project snapshots. Lists the snapshots for the specified project.\nEach snapshot represents a point-in-time backup of the project data.\n',
    inputSchema: listSnapshotsInputSchema,
    outputSchema: listSnapshotsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSnapshotsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/snapshots`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
