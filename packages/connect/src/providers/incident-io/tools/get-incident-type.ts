// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getIncidentTypeInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_type: z
      .object({
        create_in_triage: z.enum(['always', 'optional']),
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
  })
  .passthrough();

export const getIncidentTypeOutputSchema = ProviderResponseSchema;

export function getIncidentTypeTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_incident_type',
    description: 'Get incident type in incident.io.',
    inputSchema: getIncidentTypeInputSchema,
    outputSchema: getIncidentTypeOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIncidentTypeOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/incident_types/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
