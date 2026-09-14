// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listAudiencesInputSchema = z.object({}).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    data: z
      .array(
        z
          .object({ id: z.string().optional(), name: z.string().optional(), created_at: z.string().optional() })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const listAudiencesOutputSchema = ProviderResponseSchema;

export function listAudiencesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_list_audiences',
    description: 'Retrieve a list of audiences in Resend.',
    inputSchema: listAudiencesInputSchema,
    outputSchema: listAudiencesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAudiencesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/audiences`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
