// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0c4bb35bc7b4 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const setSnapshotScheduleInputSchema = z
  .object({
    project_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The Neon project ID'),
    branch_id: z.string().regex(new RegExp('^[a-z0-9-]{1,60}$')).describe('The branch ID'),
    body: z.object({
      schedule: z
        .array(
          z.object({
            frequency: z
              .string()
              .describe('How often to take snapshots. Known values: `daily`, `weekly`, `monthly`.\n'),
            hour: z
              .number()
              .int()
              .min(0)
              .max(23)
              .describe('The hour of the day to take the snapshot (if applicable).\n')
              .optional(),
            day: z
              .number()
              .int()
              .min(1)
              .max(31)
              .describe('The day of the week or month to take the snapshot (if applicable).\n')
              .optional(),
            month: z
              .number()
              .int()
              .min(1)
              .max(12)
              .describe('The month of the year to take the snapshot (if applicable).\n')
              .optional(),
            retention_seconds: z
              .number()
              .int()
              .min(3600)
              .max(3024000)
              .describe(
                "How long to keep a scheduled snapshot (in seconds) before it's automatically deleted.\nThe default is 3024000 seconds (35 days), which is also the maximum.\nManually created snapshots have no maximum retention: set their `expires_at` instead.\n",
              )
              .optional(),
          }),
        )
        .min(1)
        .describe('List of schedule entries defining the backup frequency. At least one entry is required.'),
    }),
  })
  .refine(input => input.body.schedule.length > 0, {
    message: 'Provide at least one snapshot schedule entry',
    path: ['body', 'schedule'],
  });

const ProviderResponseSchema = z.object({}).passthrough();

export const setSnapshotScheduleOutputSchema = ProviderResponseSchema;

export function setSnapshotScheduleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_set_snapshot_schedule',
    description:
      'Update backup schedule. Updates the backup schedule for the specified branch.\nThe schedule defines how often automatic snapshots are created (for example, `daily` or `weekly`). Requires a paid plan.\n',
    inputSchema: setSnapshotScheduleInputSchema,
    outputSchema: setSnapshotScheduleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof setSnapshotScheduleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/projects/${encodeURIComponent(input['project_id'])}/branches/${encodeURIComponent(input['branch_id'])}/backup_schedule`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.put(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
