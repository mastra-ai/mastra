// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listDomainsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    after: z.string().optional(),
    before: z.string().optional(),
  })
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
            status: z
              .enum(['pending', 'verified', 'failed', 'not_started', 'partially_verified', 'partially_failed'])
              .optional(),
            created_at: z.string().optional(),
            region: z.string().optional(),
            open_tracking: z.boolean().optional(),
            click_tracking: z.boolean().optional(),
            capabilities: z
              .object({
                sending: z.enum(['enabled', 'disabled']).optional(),
                receiving: z.enum(['enabled', 'disabled']).optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listDomainsOutputSchema = ProviderResponseSchema.extend({ next_cursor: z.string().optional() });

export function listDomainsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_domains',
    description: 'List domains in Resend. Returns one page; pass next_cursor as after to continue.',
    inputSchema: listDomainsInputSchema,
    outputSchema: listDomainsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDomainsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input['limit'] !== undefined) params['limit'] = input['limit'];
      if (input['after'] !== undefined) params['after'] = input['after'];
      if (input['before'] !== undefined) params['before'] = input['before'];
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return { ...data, next_cursor: data.has_more ? data.data?.at(-1)?.id : undefined };
    },
  });
}
