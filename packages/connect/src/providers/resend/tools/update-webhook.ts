// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateWebhookInputSchema = z
  .object({
    webhook_id: z.string(),
    body: z
      .object({
        endpoint: z.string().optional(),
        events: z.array(z.string()).min(1).optional(),
        status: z.enum(['enabled', 'disabled']).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ object: z.string().optional(), id: z.string().optional() }).passthrough();

export const updateWebhookOutputSchema = ProviderResponseSchema;

export function updateWebhookTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_webhook',
    description: 'Update an existing webhook in Resend.',
    inputSchema: updateWebhookInputSchema,
    outputSchema: updateWebhookOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateWebhookOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/webhooks/${encodeURIComponent(input['webhook_id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
