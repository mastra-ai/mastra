// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listSeveritiesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    severities: z.array(
      z
        .object({
          created_at: z.string(),
          description: z.string(),
          id: z.string(),
          name: z.string().max(50),
          rank: z.number().int(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listSeveritiesOutputSchema = ProviderResponseSchema;

export function listSeveritiesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_severities',
    description: 'List severities in incident.io.',
    inputSchema: listSeveritiesInputSchema,
    outputSchema: listSeveritiesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listSeveritiesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/severities`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
