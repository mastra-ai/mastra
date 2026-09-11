// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getDomainInputSchema = z.object({ domain_id: z.string() });

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    status: z
      .enum(['pending', 'verified', 'failed', 'not_started', 'partially_verified', 'partially_failed'])
      .optional(),
    created_at: z.string().optional(),
    region: z.string().optional(),
    open_tracking: z.boolean().optional(),
    click_tracking: z.boolean().optional(),
    tracking_subdomain: z.string().optional(),
    capabilities: z
      .object({
        sending: z.enum(['enabled', 'disabled']).optional(),
        receiving: z.enum(['enabled', 'disabled']).optional(),
      })
      .passthrough()
      .optional(),
    records: z
      .array(
        z
          .object({
            record: z.enum(['SPF', 'DKIM', 'Receiving', 'Tracking', 'TrackingCAA']).optional(),
            name: z.string().optional(),
            type: z.enum(['MX', 'TXT', 'CNAME', 'CAA']).optional(),
            ttl: z.string().optional(),
            status: z.enum(['pending', 'verified', 'failed', 'temporary_failure', 'not_started']).optional(),
            value: z.string().optional(),
            priority: z.number().int().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const getDomainOutputSchema = ProviderResponseSchema;

export function getDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_domain',
    description: 'Get domain in Resend.',
    inputSchema: getDomainInputSchema,
    outputSchema: getDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains/${encodeURIComponent(input['domain_id'])}`,
        retries: 3,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
