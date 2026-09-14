// AUTO-GENERATED from rhysbalevicius/integration-templates @ 2faa11af97d8 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const verifyDomainClaimInputSchema = z.object({ domain_id: z.string() }).passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    status: z
      .enum(['pending', 'verified', 'completed', 'blocked', 'expired', 'superseded', 'canceled', 'failed'])
      .optional(),
    domain_id: z.string().nullable().optional(),
    region: z.enum(['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1']).nullable().optional(),
    record: z
      .object({
        type: z.literal('TXT').optional(),
        name: z.string().optional(),
        value: z.string().optional(),
        ttl: z.string().optional(),
      })
      .passthrough()
      .optional(),
    blocked_reason: z.enum(['grace_period', 'recent_owner_activity', 'pending_scheduled_emails']).nullable().optional(),
    failure_reason: z.string().nullable().optional(),
    created_at: z.string().optional(),
    expires_at: z.string().optional(),
  })
  .passthrough();

export const verifyDomainClaimOutputSchema = ProviderResponseSchema;

export function verifyDomainClaimTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_verify_domain_claim',
    description: 'Verify a domain claim in Resend.',
    inputSchema: verifyDomainClaimInputSchema,
    outputSchema: verifyDomainClaimOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof verifyDomainClaimOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/domains/${encodeURIComponent(input['domain_id'])}/claim/verify`,
        retries: 0,
      };
      const response = await platformProxy.post(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
