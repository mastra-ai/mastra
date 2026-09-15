// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createSegmentInputSchema = z
  .object({
    body: z
      .object({
        name: z.string(),
        audience_id: z
          .string()
          .optional()
          .describe('Deprecated audience to attach the segment to. Example: "78261eea-8f8b-4381-83c6-79fa7120f1cf"'),
        filter: z.object({}).passthrough().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ id: z.string().optional(), object: z.string().optional() }).passthrough();

export const createSegmentOutputSchema = ProviderResponseSchema;

export function createSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_segment',
    description: 'Create a new segment in Resend.',
    inputSchema: createSegmentInputSchema,
    outputSchema: createSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/segments`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
