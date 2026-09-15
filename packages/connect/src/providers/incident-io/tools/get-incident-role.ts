// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getIncidentRoleInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    incident_role: z
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
  })
  .passthrough();

export const getIncidentRoleOutputSchema = ProviderResponseSchema;

export function getIncidentRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_incident_role',
    description: 'Get incident role in incident.io.',
    inputSchema: getIncidentRoleInputSchema,
    outputSchema: getIncidentRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getIncidentRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/incident_roles/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
