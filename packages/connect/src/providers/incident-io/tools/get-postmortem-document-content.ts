// AUTO-GENERATED from rhysbalevicius/integration-templates @ b5c56f19353e — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getPostmortemDocumentContentInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z.object({ markdown: z.string() }).passthrough();

export const getPostmortemDocumentContentOutputSchema = ProviderResponseSchema;

export function getPostmortemDocumentContentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_postmortem_document_content',
    description: 'Get postmortem document content in incident.io.',
    inputSchema: getPostmortemDocumentContentInputSchema,
    outputSchema: getPostmortemDocumentContentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPostmortemDocumentContentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/postmortem_documents/${encodeURIComponent(input['id'])}/content`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
