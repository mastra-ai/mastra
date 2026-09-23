// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const publishTemplateInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const publishTemplateOutputSchema = ProviderResponseSchema;

export function publishTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_publish_template',
    description: 'Publish a template in Resend.',
    inputSchema: publishTemplateInputSchema,
    outputSchema: publishTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof publishTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/templates/${encodeURIComponent(input['id'])}/publish`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
