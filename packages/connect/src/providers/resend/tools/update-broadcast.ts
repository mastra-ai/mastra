// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const updateBroadcastInputSchema = z
  .object({
    id: z.string(),
    body: z
      .object({
        name: z.string().optional(),
        audience_id: z.string().optional(),
        segment_id: z.string().optional(),
        from: z.string().optional(),
        subject: z.string().optional(),
        reply_to: z.array(z.string()).optional(),
        preview_text: z.string().optional(),
        html: z.string().optional(),
        text: z.string().optional(),
        topic_id: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const updateBroadcastOutputSchema = ProviderResponseSchema;

export function updateBroadcastTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_update_broadcast',
    description: 'Update an existing broadcast in Resend.',
    inputSchema: updateBroadcastInputSchema,
    outputSchema: updateBroadcastOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateBroadcastOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts/${encodeURIComponent(input['id'])}`,
        retries: 3,
        data: input.body,
      };
      const response = await platformProxy.patch(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
