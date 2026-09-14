// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createContactPropertyInputSchema = z
  .object({
    body: z
      .object({
        key: z.string(),
        type: z.enum(['string', 'number']),
        fallback_value: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const createContactPropertyOutputSchema = ProviderResponseSchema;

export function createContactPropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_contact_property',
    description: 'Create a new contact property in Resend.',
    inputSchema: createContactPropertyInputSchema,
    outputSchema: createContactPropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createContactPropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contact-properties`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
