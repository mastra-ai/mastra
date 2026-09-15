// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createIncidentTimelineItemInputSchema = z
  .object({
    body: z
      .object({
        description: z.string().optional(),
        idempotency_key: z.string().min(1),
        incident_id: z.string(),
        timestamp: z.string(),
        title: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    incident_timeline_item: z
      .object({
        activity_log_id: z.string().nullable().optional(),
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

export const createIncidentTimelineItemOutputSchema = ProviderResponseSchema;

export function createIncidentTimelineItemTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_create_incident_timeline_item',
    description: 'Create incident timeline item in incident.io.',
    inputSchema: createIncidentTimelineItemInputSchema,
    outputSchema: createIncidentTimelineItemOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIncidentTimelineItemOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_timeline_items`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
