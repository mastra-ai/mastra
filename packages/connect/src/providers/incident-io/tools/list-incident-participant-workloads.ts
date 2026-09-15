// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentParticipantWorkloadsInputSchema = z.object({ incident_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_participant_workloads: z.array(
      z
        .object({
          archived_at: z.string().optional(),
          participant_type: z.enum(['observer', 'collaborator', 'responder']).optional(),
          user: z
            .object({
              email: z.string().optional(),
              id: z.string(),
              name: z.string(),
              role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
              slack_user_id: z.string().optional(),
            })
            .passthrough(),
          workload: z
            .object({
              minutes_spent_on_incident: z.number(),
              minutes_spent_on_incident_in_late_hours: z.number(),
              minutes_spent_on_incident_in_sleeping_hours: z.number(),
              minutes_spent_on_incident_in_working_hours: z.number(),
            })
            .passthrough(),
        })
        .passthrough(),
    ),
    metadata: z.object({ data_synced_at: z.string().nullable().optional() }).passthrough(),
  })
  .passthrough();

export const listIncidentParticipantWorkloadsOutputSchema = ProviderResponseSchema;

export function listIncidentParticipantWorkloadsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_participant_workloads',
    description: 'List incident participant workloads in incident.io.',
    inputSchema: listIncidentParticipantWorkloadsInputSchema,
    outputSchema: listIncidentParticipantWorkloadsOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof listIncidentParticipantWorkloadsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['incident_id'] !== undefined)
        params['incident_id'] = Array.isArray(input['incident_id'])
          ? input['incident_id'].join(',')
          : String(input['incident_id']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_participant_workloads`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
