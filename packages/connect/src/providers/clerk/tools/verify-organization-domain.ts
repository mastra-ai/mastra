// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const verifyOrganizationDomainInputSchema = z.object({ organization_id: z.string(), domain_id: z.string() });

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    organization_id: z.string().optional(),
    name: z.string(),
    enrollment_mode: z.string().optional(),
    affiliation_verification: z
      .object({ attempts: z.number().optional(), status: z.string().optional() })
      .passthrough()
      .optional(),
    verification: z.object({ attempts: z.number().optional(), status: z.string().optional() }).passthrough().optional(),
    verified: z.boolean().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const verifyOrganizationDomainOutputSchema = ResourceSchema;

export function verifyOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_verify_organization_domain',
    description: 'Verify ownership of a Clerk organization domain.',
    inputSchema: verifyOrganizationDomainInputSchema,
    outputSchema: verifyOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof verifyOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Domains#operation/VerifyOrganizationDomainOwnership
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/domains/${encodeURIComponent(input.domain_id)}/verify_ownership`,
        data: {},
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
