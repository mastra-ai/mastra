// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const duplicateTemplateInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const duplicateTemplateOutputSchema = ProviderResponseSchema;

export function duplicateTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_duplicate_template',
    description: 'Duplicate a template in Resend.',
    inputSchema: duplicateTemplateInputSchema,
    outputSchema: duplicateTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof duplicateTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/templates/${encodeURIComponent(input['id'])}/duplicate`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
