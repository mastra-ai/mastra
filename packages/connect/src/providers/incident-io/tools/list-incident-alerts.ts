// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentAlertsInputSchema = z
  .object({
    page_size: z.number().int().min(1).max(50).optional(),
    after: z.string().optional(),
    alert_id: z.string().optional(),
    incident_id: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    incident_alerts: z.array(
      z
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
              status: z.enum(['firing', 'resolved']),
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
              status_category: z.enum([
                'triage',
                'declined',
                'merged',
                'canceled',
                'active',
                'post-incident',
                'closed',
                'paused',
              ]),
              summary: z.string().optional(),
              visibility: z.enum(['public', 'private']),
            })
            .passthrough(),
        })
        .passthrough(),
    ),
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
  })
  .passthrough();

export const listIncidentAlertsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listIncidentAlertsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_alerts',
    description: 'List incident alerts in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listIncidentAlertsInputSchema,
    outputSchema: listIncidentAlertsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentAlertsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      if (input['alert_id'] !== undefined)
        params['alert_id'] = Array.isArray(input['alert_id']) ? input['alert_id'].join(',') : String(input['alert_id']);
      if (input['incident_id'] !== undefined)
        params['incident_id'] = Array.isArray(input['incident_id'])
          ? input['incident_id'].join(',')
          : String(input['incident_id']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_alerts`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
