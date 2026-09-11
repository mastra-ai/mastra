// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2464f5a43eaa — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateSnapshotInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  snapshot_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The snapshot ID'),
  body: z.object({
    snapshot: z
      .object({
        name: z.string().describe('Human-readable label for the snapshot.').optional(),
        expires_at: z
          .string()
          .datetime({ offset: true })
          .nullable()
          .describe(
            'The date and time when the snapshot will expire.\n\nOmit to leave the current expiration unchanged. Send `null` to\nclear the expiration so the snapshot never expires. A future\ntimestamp sets the absolute expiration.\n',
          )
          .optional(),
      })
      .describe('Fields to update on the snapshot. Updatable fields include `name` and `expires_at`.'),
  }),
});

const ProviderResponseSchema = z
  .object({
    snapshot: z
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
  })
  .passthrough();

export const updateSnapshotOutputSchema = ProviderResponseSchema;

export function updateSnapshotTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_update_snapshot',
    description: 'Update snapshot. Updates the specified snapshot.\n',
    inputSchema: updateSnapshotInputSchema,
    outputSchema: updateSnapshotOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateSnapshotOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/snapshots/${encodeURIComponent(input['snapshot_id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
