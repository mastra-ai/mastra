// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listCatalogResourcesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    resources: z.array(
      z
        .object({
          category: z.enum(['primitive', 'custom', 'external']).or(z.string()),
          description: z.string(),
          engine_resource_type: z.string(),
          label: z.string(),
          type: z.string(),
          value_docstring: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const listCatalogResourcesOutputSchema = ProviderResponseSchema;

export function listCatalogResourcesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_catalog_resources',
    description: 'List catalog resources in incident.io.',
    inputSchema: listCatalogResourcesInputSchema,
    outputSchema: listCatalogResourcesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCatalogResourcesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v3/catalog_resources`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
