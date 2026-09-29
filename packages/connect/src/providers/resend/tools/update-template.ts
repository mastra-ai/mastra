// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateTemplateInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        name: z.string().optional(),
        alias: z.string().optional(),
        from: z.string().optional(),
        subject: z.string().optional(),
        reply_to: z.array(z.string()).optional(),
        html: z.string().optional(),
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

export const updateTemplateOutputSchema = ProviderResponseSchema;

export function updateTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_template',
    description: 'Update an existing template in Resend.',
    inputSchema: updateTemplateInputSchema,
    outputSchema: updateTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/templates/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
