// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getTeamInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    team: z
      .object({
        catalog_entry: z.object({ external_id: z.string().optional(), id: z.string(), name: z.string() }).passthrough(),
        id: z.string(),
        members: z.array(
          z
            .object({
              email: z.string().optional(),
              id: z.string(),
              name: z.string(),
              slack_user_id: z.string().optional(),
            })
            .passthrough(),
        ),
        name: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getTeamOutputSchema = ProviderResponseSchema;

export function getTeamTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_team',
    description: 'Get team in incident.io.',
    inputSchema: getTeamInputSchema,
    outputSchema: getTeamOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTeamOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/teams/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
