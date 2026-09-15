// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listIncidentRolesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_roles: z.array(
      z
        .object({
          created_at: z.string(),
          description: z.string().min(1),
          id: z.string(),
          instructions: z.string(),
          name: z.string().min(1),
          role_type: z.enum(['lead', 'reporter', 'custom']),
          shortform: z.string(),
          updated_at: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listIncidentRolesOutputSchema = ProviderResponseSchema;

export function listIncidentRolesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_incident_roles',
    description: 'List incident roles in incident.io.',
    inputSchema: listIncidentRolesInputSchema,
    outputSchema: listIncidentRolesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listIncidentRolesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_roles`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
