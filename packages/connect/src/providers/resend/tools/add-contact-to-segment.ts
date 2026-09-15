// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const addContactToSegmentInputSchema = z
  .object({ contact_id: z.string(), segment_id: z.string() })
  .passthrough();

const ProviderResponseSchema = z
  .object({ object: z.string().optional(), contact_id: z.string().optional(), segment_id: z.string().optional() })
  .passthrough();

export const addContactToSegmentOutputSchema = ProviderResponseSchema;

export function addContactToSegmentTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_add_contact_to_segment',
    description: 'Add a contact to a segment in Resend.',
    inputSchema: addContactToSegmentInputSchema,
    outputSchema: addContactToSegmentOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof addContactToSegmentOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/contacts/${encodeURIComponent(input['contact_id'])}/segments/${encodeURIComponent(input['segment_id'])}`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
