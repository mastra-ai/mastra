// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const transitionIncidentAlertInputSchema = z
  .object({ id: z.string(), body: z.object({ state: z.enum(['related', 'unrelated']) }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    incident_alert: z
      .object({
        alert: z
          .object({
            alert_group_ids: z.array(z.string()).optional(),
            alert_source_id: z.string(),
            created_at: z.string(),
            deduplication_key: z.string(),
            description: z.string().optional(),
            id: z.string(),
            resolved_at: z.string().optional(),
            source_url: z.string().optional(),
            status: z.enum(['firing', 'resolved']).or(z.string()),
            title: z.string(),
            updated_at: z.string(),
          })
          .passthrough(),
        alert_route_id: z.string().optional(),
        id: z.string(),
        incident: z
          .object({
            external_id: z.number().int(),
            id: z.string(),
            name: z.string(),
            reference: z.string(),
            status_category: z
              .enum(['triage', 'declined', 'merged', 'canceled', 'active', 'post-incident', 'closed', 'paused'])
              .or(z.string()),
            summary: z.string().optional(),
            visibility: z.enum(['public', 'private']).or(z.string()),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export const transitionIncidentAlertOutputSchema = ProviderResponseSchema;

export function transitionIncidentAlertTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_transition_incident_alert',
    description: 'Transition incident alert in incident.io.',
    inputSchema: transitionIncidentAlertInputSchema,
    outputSchema: transitionIncidentAlertOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof transitionIncidentAlertOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_alerts/${encodeURIComponent(input['id'])}/actions/transition`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
