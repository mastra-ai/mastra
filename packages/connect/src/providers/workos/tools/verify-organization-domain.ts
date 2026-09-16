// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const verifyOrganizationDomainInputSchema = z.object({ organization_domain_id: z.string() });

const ResourceSchema = z
  .object({
    object: z.literal('organization_domain'),
    id: z.string(),
    organization_id: z.string(),
    domain: z.string(),
    state: z.enum(['failed', 'legacy_verified', 'pending', 'unverified', 'verified']).optional(),
    verification_prefix: z.string().optional(),
    verification_token: z.string().optional(),
    verification_strategy: z.enum(['dns', 'manual']).optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const verifyOrganizationDomainOutputSchema = ResourceSchema;

export function verifyOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_verify_organization_domain',
    description: 'Verify a WorkOS organization domain.',
    inputSchema: verifyOrganizationDomainInputSchema,
    outputSchema: verifyOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof verifyOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/organization-domain
        endpoint: `/organization_domains/${encodeURIComponent(input.organization_domain_id)}/verify`,
        data: {},
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
