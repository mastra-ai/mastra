// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentTimestampsInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_timestamps: z.array(z.object({ id: z.string(), name: z.string(), rank: z.number().int() }).passthrough()),
  })
  .passthrough();

export const listIncidentTimestampsOutputSchema = ProviderResponseSchema;

export function listIncidentTimestampsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_timestamps',
    description: 'List incident timestamps in incident.io.',
    inputSchema: listIncidentTimestampsInputSchema,
    outputSchema: listIncidentTimestampsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentTimestampsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_timestamps`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
