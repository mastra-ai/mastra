// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listWebhooksInputSchema = z
  .object({ limit: z.number().int().optional(), after: z.string().optional(), before: z.string().optional() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    has_more: z.boolean().optional(),
    data: z
      .array(
        z
          .object({
            id: z.string().optional(),
            endpoint: z.string().optional(),
            events: z.array(z.string()).nullable().optional(),
            status: z.string().optional(),
            created_at: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listWebhooksOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listWebhooksTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_webhooks',
    description: 'Retrieve a list of webhooks in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listWebhooksInputSchema,
    outputSchema: listWebhooksOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listWebhooksOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['limit'] !== undefined)
        params['limit'] = Array.isArray(input['limit']) ? input['limit'].join(',') : String(input['limit']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      if (input['before'] !== undefined)
        params['before'] = Array.isArray(input['before']) ? input['before'].join(',') : String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
