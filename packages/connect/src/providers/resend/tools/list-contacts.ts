// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listContactsInputSchema = z
  .object({
    segment_id: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    data: z
      .array(
        z
          .object({
            id: z.string().optional(),
            email: z.string().optional(),
            first_name: z.string().nullable().optional(),
            last_name: z.string().nullable().optional(),
            created_at: z.string().optional(),
            unsubscribed: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listContactsOutputSchema = ProviderResponseSchema;

export function listContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_contacts',
    description: 'Retrieve a list of contacts in Resend.',
    inputSchema: listContactsInputSchema,
    outputSchema: listContactsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['segment_id'] !== undefined)
        params['segment_id'] = Array.isArray(input['segment_id'])
          ? input['segment_id'].join(',')
          : String(input['segment_id']);
      if (input['limit'] !== undefined)
        params['limit'] = Array.isArray(input['limit']) ? input['limit'].join(',') : String(input['limit']);
      if (input['after'] !== undefined)
        params['after'] = Array.isArray(input['after']) ? input['after'].join(',') : String(input['after']);
      if (input['before'] !== undefined)
        params['before'] = Array.isArray(input['before']) ? input['before'].join(',') : String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
