// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listContactTopicsInputSchema = z
  .object({
    contact_id: z.string(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
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
            name: z.string().optional(),
            description: z.string().optional(),
            subscription: z.enum(['opt_in', 'opt_out']).optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listContactTopicsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listContactTopicsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_contact_topics',
    description: 'Retrieve topics for a contact in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listContactTopicsInputSchema,
    outputSchema: listContactTopicsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactTopicsOutputSchema>> => {
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
        endpoint: `/contacts/${encodeURIComponent(input['contact_id'])}/topics`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
