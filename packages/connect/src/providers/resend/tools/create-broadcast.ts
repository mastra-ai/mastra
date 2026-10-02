// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createBroadcastInputSchema = z
  .object({
    body: z
      .object({
        name: z.string().optional(),
        segment_id: z.string(),
        audience_id: z.string().optional(),
        from: z.string(),
        subject: z.string(),
        reply_to: z.array(z.string()).optional(),
        preview_text: z.string().optional(),
        html: z.string().optional(),
        text: z.string().optional(),
        topic_id: z.string().optional(),
        send: z.boolean().optional(),
        scheduled_at: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const createBroadcastOutputSchema = ProviderResponseSchema;

export function createBroadcastTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_broadcast',
    description: 'Create a broadcast in Resend.',
    inputSchema: createBroadcastInputSchema,
    outputSchema: createBroadcastOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createBroadcastOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
