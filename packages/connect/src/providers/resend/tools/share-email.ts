// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const shareEmailInputSchema = z
  .object({ email_id: z.string(), body: z.object({ expires_in: z.string().optional() }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z
  .object({ object: z.string().optional(), id: z.string().optional(), url: z.string().optional() })
  .passthrough();

export const shareEmailOutputSchema = ProviderResponseSchema;

export function shareEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_share_email',
    description: 'Create a shareable link for a sent or received email in Resend.',
    inputSchema: shareEmailInputSchema,
    outputSchema: shareEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof shareEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/${encodeURIComponent(input['email_id'])}/share`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
