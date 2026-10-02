// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateContactTopicsInputSchema = z
  .object({
    contact_id: z.string(),
    body: z
      .object({
        topics: z.array(z.object({ id: z.string(), subscription: z.enum(['opt_in', 'opt_out']) }).passthrough()),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    contact_id: z.string().optional(),
    topics: z
      .array(
        z
          .object({ id: z.string().optional(), subscription: z.enum(['opt_in', 'opt_out']).or(z.string()).optional() })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const updateContactTopicsOutputSchema = ProviderResponseSchema;

export function updateContactTopicsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_contact_topics',
    description: 'Update topics for a contact in Resend.',
    inputSchema: updateContactTopicsInputSchema,
    outputSchema: updateContactTopicsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateContactTopicsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['contact_id'])}/topics`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
