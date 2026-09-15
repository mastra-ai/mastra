// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getTemplateInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    current_version_id: z.string().optional(),
    name: z.string().optional(),
    alias: z.string().optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    reply_to: z.array(z.string()).nullable().optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    variables: z
      .array(
        z
          .object({
            id: z.string().optional(),
            key: z.string(),
            type: z.enum(['string', 'number', 'boolean', 'object', 'list']),
            fallback_value: z
              .union([z.string(), z.number(), z.boolean(), z.object({}).passthrough(), z.array(z.unknown())])
              .optional(),
            created_at: z.string().optional(),
            updated_at: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    status: z.enum(['draft', 'published']).optional(),
    published_at: z.string().nullable().optional(),
    has_unpublished_versions: z.boolean().optional(),
  })
  .passthrough();

export const getTemplateOutputSchema = ProviderResponseSchema;

export function getTemplateTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_template',
    description: 'Retrieve a single template in Resend.',
    inputSchema: getTemplateInputSchema,
    outputSchema: getTemplateOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTemplateOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/templates/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
