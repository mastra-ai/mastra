// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
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
            name: z.string().optional(),
            description: z.string().optional(),
            subscription: z.enum(['opt_in', 'opt_out']).or(z.string()).optional(),
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
    description:
      'Retrieve topics for a contact in Resend. Returns one page; pass next_cursor back as after, or as before when paginating backwards, to continue.',
    inputSchema: listContactTopicsInputSchema,
    outputSchema: listContactTopicsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listContactTopicsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['limit'] !== undefined) params['limit'] = String(input['limit']);
      if (input['after'] !== undefined) params['after'] = String(input['after']);
      if (input['before'] !== undefined) params['before'] = String(input['before']);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['contact_id'])}/topics`,
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
