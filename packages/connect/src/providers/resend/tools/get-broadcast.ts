// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getBroadcastInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    audience_id: z.string().nullable().optional(),
    segment_id: z.string().nullable().optional(),
    from: z.string().optional(),
    subject: z.string().optional(),
    reply_to: z.array(z.string()).nullable().optional(),
    preview_text: z.string().optional(),
    status: z.string().optional(),
    created_at: z.string().optional(),
    scheduled_at: z.string().nullable().optional(),
    sent_at: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    html: z.string().nullable().optional(),
    topic_id: z.string().nullable().optional(),
  })
  .passthrough();

export const getBroadcastOutputSchema = ProviderResponseSchema;

export function getBroadcastTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_broadcast',
    description: 'Retrieve a single broadcast in Resend.',
    inputSchema: getBroadcastInputSchema,
    outputSchema: getBroadcastOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getBroadcastOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/broadcasts/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
