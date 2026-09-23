// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOrganizationDomainInputSchema = z.object({ organization_domain_id: z.string() });

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

export const getOrganizationDomainOutputSchema = ResourceSchema;

export function getOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_organization_domain',
    description: 'Get a WorkOS organization domain.',
    inputSchema: getOrganizationDomainInputSchema,
    outputSchema: getOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/organization-domain
        endpoint: `/organization_domains/${encodeURIComponent(input.organization_domain_id)}`,

        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
