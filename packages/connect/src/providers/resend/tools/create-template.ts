// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createTemplateInputSchema = z
  .object({
    body: z
      .object({
        name: z.string(),
        alias: z.string().optional(),
        from: z.string().optional(),
        subject: z.string().optional(),
        reply_to: z.array(z.string()).optional(),
        html: z.string(),
        text: z.string().optional(),
        variables: z
          .array(
            z
              .object({
                key: z.string(),
                type: z.enum(['string', 'number', 'boolean', 'object', 'list']),
                fallback_value: z
                  .union([z.string(), z.number(), z.boolean(), z.object({}).passthrough(), z.array(z.unknown())])
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const createTemplateOutputSchema = ProviderResponseSchema;

export function createTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_template',
    description: 'Create a template in Resend.',
    inputSchema: createTemplateInputSchema,
    outputSchema: createTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/templates`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
