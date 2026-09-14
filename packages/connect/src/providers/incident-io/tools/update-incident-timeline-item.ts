// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateIncidentTimelineItemInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        description: z.string().optional(),
        timestamp: z.string().optional(),
        title: z.string().min(1).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    incident_timeline_item: z
      .object({
        activity_log_id: z.string().optional(),
        created_at: z.string(),
        creator: z
          .object({
            alert: z.object({ id: z.string(), title: z.string() }).passthrough().optional(),
            api_key: z.object({ id: z.string(), name: z.string() }).passthrough().optional(),
            user: z
              .object({
                email: z.string().optional(),
                id: z.string(),
                name: z.string(),
                role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
                slack_user_id: z.string().optional(),
              })
              .passthrough()
              .optional(),
            workflow: z.object({ id: z.string(), name: z.string() }).passthrough().optional(),
          })
          .passthrough(),
        description: z.string().optional(),
        id: z.string(),
        incident_id: z.string(),
        timestamp: z.string(),
        title: z.string(),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const updateIncidentTimelineItemOutputSchema = ProviderResponseSchema;

export function updateIncidentTimelineItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_update_incident_timeline_item',
    description: 'Update incident timeline item in incident.io.',
    inputSchema: updateIncidentTimelineItemInputSchema,
    outputSchema: updateIncidentTimelineItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateIncidentTimelineItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_timeline_items/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
