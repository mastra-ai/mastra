// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getSeverityInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    severity: z
      .object({
        created_at: z.string(),
        description: z.string(),
        id: z.string(),
        name: z.string().max(50),
        rank: z.number().int(),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getSeverityOutputSchema = ProviderResponseSchema;

export function getSeverityTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_severity',
    description: 'Get severity in incident.io.',
    inputSchema: getSeverityInputSchema,
    outputSchema: getSeverityOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSeverityOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/severities/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
