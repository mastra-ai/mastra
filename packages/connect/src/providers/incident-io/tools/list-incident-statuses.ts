// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentStatusesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_statuses: z.array(
      z
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
    ),
  })
  .passthrough();

export const listIncidentStatusesOutputSchema = ProviderResponseSchema;

export function listIncidentStatusesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_statuses',
    description: 'List incident statuses in incident.io.',
    inputSchema: listIncidentStatusesInputSchema,
    outputSchema: listIncidentStatusesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentStatusesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/incident_statuses`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
