// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listScheduleReplicasInputSchema = z.object({ schedule_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    schedule_replicas: z.array(
      z
        .object({
          created_at: z.string(),
          id: z.string(),
          last_sync_error: z.string().nullable().optional(),
          last_synced_at: z.string().nullable().optional(),
          mirror_window_days: z.number().int().min(1).max(90).optional(),
          replica_fallback_user_id: z.string(),
          replica_provider: z.enum(['native', 'pagerduty', 'opsgenie', 'jsm']),
          replica_provider_id: z.string(),
          schedule_id: z.string(),
          sources: z.array(z.object({ layer_id: z.string(), rotation_id: z.string() }).passthrough()),
          updated_at: z.string(),
          user_statuses: z.array(
            z.object({ external_user_id: z.string().nullable().optional(), user_id: z.string() }).passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listScheduleReplicasOutputSchema = ProviderResponseSchema;

export function listScheduleReplicasTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_schedule_replicas',
    description: 'List schedule replicas in incident.io.',
    inputSchema: listScheduleReplicasInputSchema,
    outputSchema: listScheduleReplicasOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listScheduleReplicasOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedules/${encodeURIComponent(input['schedule_id'])}/replicas`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
