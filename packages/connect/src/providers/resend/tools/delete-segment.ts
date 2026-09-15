// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const deleteSegmentInputSchema = z.object({ id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({ id: z.string().optional(), object: z.string().optional(), deleted: z.boolean().optional() })
  .passthrough();

export const deleteSegmentOutputSchema = ProviderResponseSchema;

export function deleteSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_delete_segment',
    description: 'Remove an existing segment in Resend.',
    inputSchema: deleteSegmentInputSchema,
    outputSchema: deleteSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/segments/${encodeURIComponent(input['id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
