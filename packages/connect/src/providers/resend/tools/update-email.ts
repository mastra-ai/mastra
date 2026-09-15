// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateEmailInputSchema = z
  .object({ email_id: z.string(), body: z.object({ scheduled_at: z.string().optional() }).passthrough() })
  .passthrough();

const ProviderResponseSchema = z.object({ scheduled_at: z.string().optional() }).passthrough();

export const updateEmailOutputSchema = ProviderResponseSchema;

export function updateEmailTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_email',
    description: 'Update a single email in Resend.',
    inputSchema: updateEmailInputSchema,
    outputSchema: updateEmailOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateEmailOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/${encodeURIComponent(input['email_id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
