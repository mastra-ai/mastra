// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateContactInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        email: z.string().optional(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        unsubscribed: z.boolean().optional(),
        properties: z.object({}).passthrough().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ object: z.string().optional(), id: z.string().optional() }).passthrough();

export const updateContactOutputSchema = ProviderResponseSchema;

export function updateContactTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_contact',
    description: 'Update a single contact by ID or email in Resend.',
    inputSchema: updateContactInputSchema,
    outputSchema: updateContactOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateContactOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
