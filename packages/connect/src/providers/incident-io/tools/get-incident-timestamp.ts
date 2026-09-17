// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getIncidentTimestampInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ incident_timestamp: z.object({ id: z.string(), name: z.string(), rank: z.number().int() }).passthrough() })
  .passthrough();

export const getIncidentTimestampOutputSchema = ProviderResponseSchema;

export function getIncidentTimestampTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_incident_timestamp',
    description: 'Get incident timestamp in incident.io.',
    inputSchema: getIncidentTimestampInputSchema,
    outputSchema: getIncidentTimestampOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIncidentTimestampOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_timestamps/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
