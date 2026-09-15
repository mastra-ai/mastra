// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getScheduleReplicaInputSchema = z.object({ schedule_id: z.string(), id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    schedule_replica: z
      .object({
        created_at: z.string(),
        id: z.string(),
        last_sync_error: z.string().nullable().optional(),
        last_synced_at: z.string().nullable().optional(),
        mirror_window_days: z.number().int().min(1).max(90).optional(),
        replica_fallback_user_id: z.string(),
        replica_provider: z.enum(['native', 'pagerduty', 'opsgenie', 'jsm']).or(z.string()),
        replica_provider_id: z.string(),
        schedule_id: z.string(),
        sources: z.array(z.object({ layer_id: z.string(), rotation_id: z.string() }).passthrough()),
        updated_at: z.string(),
        user_statuses: z.array(
          z.object({ external_user_id: z.string().nullable().optional(), user_id: z.string() }).passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();

export const getScheduleReplicaOutputSchema = ProviderResponseSchema;

export function getScheduleReplicaTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_schedule_replica',
    description: 'Get schedule replica in incident.io.',
    inputSchema: getScheduleReplicaInputSchema,
    outputSchema: getScheduleReplicaOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getScheduleReplicaOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/schedules/${encodeURIComponent(input['schedule_id'])}/replicas/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
