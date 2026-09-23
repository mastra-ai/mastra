// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrganizationDomainInputSchema = z.object({ organization_id: z.string(), domain: z.string() });

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

export const createOrganizationDomainOutputSchema = ResourceSchema;

export function createOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_create_organization_domain',
    description: 'Create a WorkOS organization domain.',
    inputSchema: createOrganizationDomainInputSchema,
    outputSchema: createOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/organization-domain
        endpoint: '/organization_domains',
        data: { organization_id: input.organization_id, domain: input.domain },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
