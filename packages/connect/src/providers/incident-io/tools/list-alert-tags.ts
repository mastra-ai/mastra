// AUTO-GENERATED from rhysbalevicius/integration-templates @ 0a9bc570eb76 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listAlertTagsInputSchema = z
  .object({
    page_size: z.number().int().min(1).max(250).optional(),
    after: z.string().optional(),
    search: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    alert_tags: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
    pagination_meta: z.object({ after: z.string().optional(), page_size: z.number().int().max(250) }).passthrough(),
  })
  .passthrough();

export const listAlertTagsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listAlertTagsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'incident_io_list_alert_tags',
    description: 'List alert tags in incident.io. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listAlertTagsInputSchema,
    outputSchema: listAlertTagsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAlertTagsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['page_size'] !== undefined) params['page_size'] = String(input['page_size']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      if (input['search'] !== undefined) params['search'] = String(input['search']);
      const config: PlatformProxyRequest = {
        // https://api.incident.io/v1/openapiV3.json,
        endpoint: `/v2/alert_tags`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.pagination_meta?.after || undefined };
    },
  });
}
