// AUTO-GENERATED from rhysbalevicius/integration-templates @ ac255e042871 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const removeContactFromSegmentInputSchema = z
  .object({ contact_id: z.string(), segment_id: z.string() })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    contact_id: z.string().optional(),
    segment_id: z.string().optional(),
    deleted: z.boolean().optional(),
  })
  .passthrough();

export const removeContactFromSegmentOutputSchema = ProviderResponseSchema;

export function removeContactFromSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_remove_contact_from_segment',
    description: 'Remove a contact from a segment in Resend.',
    inputSchema: removeContactFromSegmentInputSchema,
    outputSchema: removeContactFromSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeContactFromSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['contact_id'])}/segments/${encodeURIComponent(input['segment_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.delete(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
