// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const createDomainClaimInputSchema = z
  .object({
    body: z
      .object({
        name: z.string(),
        region: z.enum(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']).optional(),
        custom_return_path: z.string().optional(),
        open_tracking: z.boolean().optional(),
        click_tracking: z.boolean().optional(),
        tracking_subdomain: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    status: z
      .enum(['pending', 'verified', 'completed', 'blocked', 'expired', 'superseded', 'canceled', 'failed'])
      .or(z.string())
      .optional(),
    domain_id: z.string().nullable().optional(),
    region: z.enum(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']).or(z.string()).nullable().optional(),
    record: z
      .object({
        type: z.literal('TXT').optional(),
        name: z.string().optional(),
        value: z.string().optional(),
        ttl: z.string().optional(),
      })
      .passthrough()
      .optional(),
    blocked_reason: z
      .enum(['grace_period', 'recent_owner_activity', 'pending_scheduled_emails'])
      .or(z.string())
      .nullable()
      .optional(),
    failure_reason: z.string().nullable().optional(),
    created_at: z.string().optional(),
    expires_at: z.string().optional(),
  })
  .passthrough();

export const createDomainClaimOutputSchema = ProviderResponseSchema;

export function createDomainClaimTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_create_domain_claim',
    description: 'Claim a domain in Resend.',
    inputSchema: createDomainClaimInputSchema,
    outputSchema: createDomainClaimOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createDomainClaimOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains/claim`,
        retries: 0,
        data: input.body,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
