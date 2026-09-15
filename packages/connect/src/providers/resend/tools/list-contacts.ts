// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
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
  .passthrough()
  .refine(input => input.after === undefined || input.before === undefined, {
    message: 'Use either after or before, not both',
  });

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    has_more: z.boolean().optional(),
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

export const listContactsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listContactsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_contacts',
    description:
      'Retrieve a list of contacts in Resend. Returns one page; pass next_cursor back as after, or as before when paginating backwards, to continue.',
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
      const nextCursor = input['before'] !== undefined ? data.data?.[0]?.id : data.data?.at(-1)?.id;
      return { ...data, next_cursor: data.has_more ? nextCursor : undefined };
    },
  });
}
