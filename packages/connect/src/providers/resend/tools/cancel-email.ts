// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const cancelEmailInputSchema = z.object({ email_id: z.string() });

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    message_id: z.string().optional(),
    to: z.array(z.string()).optional(),
    from: z.string().optional(),
    created_at: z.string().optional(),
    subject: z.string().optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    bcc: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    reply_to: z.array(z.string()).optional(),
    last_event: z
      .enum([
        'bounced',
        'canceled',
        'clicked',
        'complained',
        'delivered',
        'delivery_delayed',
        'failed',
        'opened',
        'queued',
        'scheduled',
        'sent',
        'suppressed',
      ])
      .optional(),
  })
  .passthrough();

export const cancelEmailOutputSchema = ProviderResponseSchema;

export function cancelEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_cancel_email',
    description: 'Cancel email in Resend.',
    inputSchema: cancelEmailInputSchema,
    outputSchema: cancelEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof cancelEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/${encodeURIComponent(input['email_id'])}/cancel`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
