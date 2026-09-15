// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createIncidentUpdateInputSchema = z
  .object({
    body: z
      .object({
        idempotency_key: z.string(),
        incident_id: z.string(),
        message: z.string().optional(),
        to_incident_status_id: z.string().optional(),
        to_severity_id: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    incident_update: z
      .object({
        created_at: z.string(),
        id: z.string(),
        incident_id: z.string(),
        merged_into_incident_id: z.string().optional(),
        message: z.string().optional(),
        new_incident_status: z
          .object({
            category: z.enum(['triage', 'declined', 'merged', 'canceled', 'live', 'learning', 'closed', 'paused']),
            created_at: z.string(),
            description: z.string(),
            id: z.string(),
            name: z.string(),
            rank: z.number().int(),
            updated_at: z.string(),
          })
          .passthrough(),
        new_severity: z
          .object({
            created_at: z.string(),
            description: z.string(),
            id: z.string(),
            name: z.string().max(50),
            rank: z.number().int(),
            updated_at: z.string(),
          })
          .passthrough()
          .optional(),
        updater: z
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
      })
      .passthrough(),
  })
  .passthrough();

export const createIncidentUpdateOutputSchema = ProviderResponseSchema;

export function createIncidentUpdateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_create_incident_update',
    description: 'Create incident update in incident.io.',
    inputSchema: createIncidentUpdateInputSchema,
    outputSchema: createIncidentUpdateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createIncidentUpdateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_updates`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
