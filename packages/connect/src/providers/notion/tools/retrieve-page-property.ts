// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const retrievePagePropertyInputSchema = z.object({
  page_id: z.string().describe('The ID of the page. Example: "2b6ce298-3121-80ae-bfe1-f8984b993639"'),
  property_id: z.string().describe('The ID or name of the property to retrieve. Example: "title"'),
});

export const retrievePagePropertyOutputSchema = z.object({
  object: z.string(),
  type: z.string(),
  results: z.array(z.any()).optional(),
  property_item: z.any().optional(),
});

export function retrievePagePropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'notion_retrieve_page_property',
    description: 'Gets a specific property value from a page with pagination support.',
    inputSchema: retrievePagePropertyInputSchema,
    outputSchema: retrievePagePropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof retrievePagePropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.notion.com/reference/retrieve-a-page-property
        endpoint: `v1/pages/${input.page_id}/properties/${input.property_id}`,
        retries: 3,
      };

      const response = await platformProxy.get(config);
      const data = response.data;

      return {
        object: data.object,
        type: data.type,
        results: data.results ?? null,
        property_item: data.property_item ?? null,
      };
    },
  });
}
