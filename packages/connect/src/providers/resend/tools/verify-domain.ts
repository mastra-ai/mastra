// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const verifyDomainInputSchema = z.object({ domain_id: z.string() });

const ProviderResponseSchema = z.object({ object: z.string().optional(), id: z.string().optional() }).passthrough();

export const verifyDomainOutputSchema = ProviderResponseSchema;

export function verifyDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_verify_domain',
    description: 'Verify domain in Resend.',
    inputSchema: verifyDomainInputSchema,
    outputSchema: verifyDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof verifyDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains/${encodeURIComponent(input['domain_id'])}/verify`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
