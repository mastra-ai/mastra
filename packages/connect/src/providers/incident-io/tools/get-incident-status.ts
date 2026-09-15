// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getIncidentStatusInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_status: z
      .object({
        category: z
          .enum(['triage', 'declined', 'merged', 'canceled', 'live', 'learning', 'closed', 'paused'])
          .or(z.string()),
        created_at: z.string(),
        description: z.string(),
        id: z.string(),
        name: z.string(),
        rank: z.number().int(),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getIncidentStatusOutputSchema = ProviderResponseSchema;

export function getIncidentStatusTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_incident_status',
    description: 'Get incident status in incident.io.',
    inputSchema: getIncidentStatusInputSchema,
    outputSchema: getIncidentStatusOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIncidentStatusOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/incident_statuses/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
