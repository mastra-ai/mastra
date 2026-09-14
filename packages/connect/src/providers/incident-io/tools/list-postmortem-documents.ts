// AUTO-GENERATED from rhysbalevicius/integration-templates @ 3ad35d4bf046 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listPostmortemDocumentsInputSchema = z
  .object({
    page_size: z.number().int().min(1).max(250).optional(),
    after: z.string().optional(),
    incident_id: z.string().optional(),
    sort_by: z.enum(['created_at_newest_first', 'created_at_oldest_first']).optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
    postmortem_documents: z.array(
      z
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
    ),
  })
  .passthrough();

export const listPostmortemDocumentsOutputSchema = ProviderResponseSchema.extend({
  next_cursor: z.string().optional(),
});

export function listPostmortemDocumentsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_postmortem_documents',
    description: 'List postmortem documents in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listPostmortemDocumentsInputSchema,
    outputSchema: listPostmortemDocumentsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listPostmortemDocumentsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['page_size'] !== undefined)
        params['page_size'] = Array.isArray(input['page_size'])
          ? input['page_size'].join(',')
          : String(input['page_size']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      if (input['incident_id'] !== undefined)
        params['incident_id'] = Array.isArray(input['incident_id'])
          ? input['incident_id'].join(',')
          : String(input['incident_id']);
      if (input['sort_by'] !== undefined)
        params['sort_by'] = Array.isArray(input['sort_by']) ? input['sort_by'].join(',') : String(input['sort_by']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v1/postmortem_documents`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
