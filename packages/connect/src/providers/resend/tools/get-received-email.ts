// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getReceivedEmailInputSchema = z.object({ email_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    to: z.array(z.string()).optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    message_id: z.string().optional(),
    bcc: z.array(z.string()).nullable().optional(),
    cc: z.array(z.string()).nullable().optional(),
    reply_to: z.array(z.string()).nullable().optional(),
    received_for: z.array(z.string()).optional(),
    html: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    headers: z.object({}).passthrough().nullable().optional(),
    created_at: z.string().optional(),
    attachments: z
      .array(
        z
          .object({
            id: z.string().optional(),
            filename: z.string().nullable().optional(),
            content_type: z.string().optional(),
            content_id: z.string().optional(),
            content_disposition: z.enum(['inline', 'attachment']).or(z.string()).nullable().optional(),
            size: z.number().int().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const getReceivedEmailOutputSchema = ProviderResponseSchema;

export function getReceivedEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_received_email',
    description: 'Retrieve a single received email in Resend.',
    inputSchema: getReceivedEmailInputSchema,
    outputSchema: getReceivedEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getReceivedEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/receiving/${encodeURIComponent(input['email_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
