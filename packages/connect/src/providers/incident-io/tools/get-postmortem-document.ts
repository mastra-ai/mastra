// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getPostmortemDocumentInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    postmortem_document: z
      .object({
        created_at: z.string(),
        document_url: z.string(),
        editors: z.array(
          z
            .object({
              email: z.string().optional(),
              id: z.string(),
              name: z.string(),
              role: z.enum(['viewer', 'responder', 'administrator', 'owner', 'unset']),
              slack_user_id: z.string().optional(),
            })
            .passthrough(),
        ),
        exported_urls: z.array(z.string()),
        id: z.string(),
        incident_id: z.string(),
        status: z.enum(['in_progress', 'in_review', 'completed']),
        title: z.string(),
        type: z.enum(['in_app', 'external']),
        updated_at: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const getPostmortemDocumentOutputSchema = ProviderResponseSchema;

export function getPostmortemDocumentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_get_postmortem_document',
    description: 'Get postmortem document in incident.io.',
    inputSchema: getPostmortemDocumentInputSchema,
    outputSchema: getPostmortemDocumentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPostmortemDocumentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/postmortem_documents/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
