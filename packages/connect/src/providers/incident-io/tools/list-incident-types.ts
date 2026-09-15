// AUTO-GENERATED from rhysbalevicius/integration-templates @ c4fb0d5d5b2c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentTypesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_types: z.array(
      z
        .object({
          create_in_triage: z.enum(['always', 'optional']).or(z.string()),
          created_at: z.string(),
          description: z.string(),
          id: z.string(),
          is_default: z.boolean(),
          name: z.string(),
          owning_team_ids: z.array(z.string()).optional(),
          private_incidents_only: z.boolean(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listIncidentTypesOutputSchema = ProviderResponseSchema;

export function listIncidentTypesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_types',
    description: 'List incident types in incident.io.',
    inputSchema: listIncidentTypesInputSchema,
    outputSchema: listIncidentTypesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentTypesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/incident_types`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
