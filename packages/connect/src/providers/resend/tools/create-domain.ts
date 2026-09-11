// AUTO-GENERATED from rhysbalevicius/integration-templates @ cfb727cbc131 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createDomainInputSchema = z.object({
  body: z.object({
    name: z.string(),
    region: z.enum(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']).optional(),
    custom_return_path: z.string().optional(),
    open_tracking: z.boolean().optional(),
    click_tracking: z.boolean().optional(),
    tls: z.enum(['opportunistic', 'enforced']).optional(),
    capabilities: z
      .object({
        sending: z.enum(['enabled', 'disabled']).optional(),
        receiving: z.enum(['enabled', 'disabled']).optional(),
      })
      .optional(),
    tracking_subdomain: z.string().optional(),
  }),
});

const ProviderResponseSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    created_at: z.string().optional(),
    status: z
      .enum(['pending', 'verified', 'failed', 'not_started', 'partially_verified', 'partially_failed'])
      .optional(),
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
    region: z.string().optional(),
    open_tracking: z.boolean().optional(),
    click_tracking: z.boolean().optional(),
    tracking_subdomain: z.string().optional(),
  })
  .passthrough();

export const createDomainOutputSchema = ProviderResponseSchema;

export function createDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_domain',
    description: 'Create domain in Resend.',
    inputSchema: createDomainInputSchema,
    outputSchema: createDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
