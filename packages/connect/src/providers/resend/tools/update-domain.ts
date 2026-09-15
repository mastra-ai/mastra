// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateDomainInputSchema = z
  .object({
    domain_id: z.string(),
    body: z
      .object({
        open_tracking: z.boolean().optional(),
        click_tracking: z.boolean().optional(),
        tls: z.enum(['opportunistic', 'enforced']).optional(),
        capabilities: z
          .object({
            sending: z.enum(['enabled', 'disabled']).optional(),
            receiving: z.enum(['enabled', 'disabled']).optional(),
          })
          .passthrough()
          .optional(),
        tracking_subdomain: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const updateDomainOutputSchema = ProviderResponseSchema;

export function updateDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_domain',
    description: 'Update an existing domain in Resend.',
    inputSchema: updateDomainInputSchema,
    outputSchema: updateDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains/${encodeURIComponent(input['domain_id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
