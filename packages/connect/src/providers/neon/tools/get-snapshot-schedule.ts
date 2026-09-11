// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getSnapshotScheduleInputSchema = z.object({
  project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
  branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
});

const ProviderResponseSchema = z
  .object({
    schedule: z.array(
      z
        .object({
          frequency: z.string(),
          hour: z.number().int().min(0).max(23).optional(),
          day: z.number().int().min(1).max(31).optional(),
          month: z.number().int().min(1).max(12).optional(),
          retention_seconds: z.number().int().min(3600).max(3024000).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const getSnapshotScheduleOutputSchema = ProviderResponseSchema;

export function getSnapshotScheduleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_get_snapshot_schedule',
    description:
      'Retrieve backup schedule. Returns the backup schedule for the specified branch, including the configured snapshot frequencies.\n',
    inputSchema: getSnapshotScheduleInputSchema,
    outputSchema: getSnapshotScheduleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSnapshotScheduleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/backup_schedule`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
