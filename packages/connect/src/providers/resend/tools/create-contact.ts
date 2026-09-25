// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createContactInputSchema = z
  .object({
    body: z
      .object({
        email: z.string(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        unsubscribed: z.boolean().optional(),
        properties: z.object({}).passthrough().optional(),
        segments: z.array(z.object({ id: z.string().optional() }).passthrough()).optional(),
        topics: z
          .array(
            z
              .object({ id: z.string().optional(), subscription: z.enum(['opt_in', 'opt_out']).optional() })
              .passthrough(),
          )
          .optional(),
        audience_id: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ object: z.string().optional(), id: z.string().optional() }).passthrough();

export const createContactOutputSchema = ProviderResponseSchema;

export function createContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_contact',
    description: 'Create a new contact in Resend.',
    inputSchema: createContactInputSchema,
    outputSchema: createContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
