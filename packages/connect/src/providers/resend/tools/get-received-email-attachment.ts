// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getReceivedEmailAttachmentInputSchema = z
  .object({ email_id: z.string(), attachment_id: z.string() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    filename: z.string().nullable().optional(),
    content_type: z.string().optional(),
    content_id: z.string().optional(),
    content_disposition: z.enum(['inline', 'attachment']).or(z.string()).nullable().optional(),
    download_url: z.string().optional(),
    expires_at: z.string().optional(),
    size: z.number().int().optional(),
  })
  .passthrough();

export const getReceivedEmailAttachmentOutputSchema = ProviderResponseSchema;

export function getReceivedEmailAttachmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_received_email_attachment',
    description: 'Retrieve a single attachment for a received email in Resend.',
    inputSchema: getReceivedEmailAttachmentInputSchema,
    outputSchema: getReceivedEmailAttachmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getReceivedEmailAttachmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/receiving/${encodeURIComponent(input['email_id'])}/attachments/${encodeURIComponent(input['attachment_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
