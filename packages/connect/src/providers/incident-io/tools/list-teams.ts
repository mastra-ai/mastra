// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listTeamsInputSchema = z
  .object({ page_size: z.number().int().min(1).max(250).optional(), after: z.string().optional() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
    teams: z.array(
      z
        .object({
          catalog_entry: z
            .object({ external_id: z.string().optional(), id: z.string(), name: z.string() })
            .passthrough(),
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
    ),
  })
  .passthrough();

export const listTeamsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listTeamsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_teams',
    description: 'List teams in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listTeamsInputSchema,
    outputSchema: listTeamsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTeamsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/teams`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
