// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3e5c6ed7617f — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listRegionsInputSchema = z.object({
  org_id: z
    .string()
    .regex(new RegExp('^[a-z0-9-]{1,60}$'))
    .describe(
      'Organization ID. When provided, returns only regions available to this organization.\nRecommended for accurate region availability.\n',
    )
    .optional(),
});

const ProviderResponseSchema = z
  .object({
    regions: z.array(
      z
        .object({
          region_id: z.string(),
          name: z.string(),
          default: z.boolean(),
          geo_lat: z.string(),
          geo_long: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listRegionsOutputSchema = ProviderResponseSchema;

export function listRegionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'neon_list_regions',
    description:
      'List supported regions. Lists supported Neon regions.\n\n**Note:** Not all regions are available to all organizations. Pass the `org_id`\nparameter to get an accurate list of regions available to your organization.\n',
    inputSchema: listRegionsInputSchema,
    outputSchema: listRegionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listRegionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['org_id'] !== undefined) params['org_id'] = input['org_id'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/neondatabase/neon-pkgs/af5a839e5900dc98120af6261b5b29d02c74a8e1/packages/sdk/spec/neon-openapi.json,
        endpoint: `/v2/regions`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
