// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EnrollmentModeSchema = z.enum([
  'manual_invitation',
  'automatic_invitation',
  'automatic_suggestion',
  'enterprise_sso',
]);

export const updateOrganizationDomainInputSchema = z.object({
  organization_id: z.string(),
  domain_id: z.string(),
  enrollment_mode: EnrollmentModeSchema.optional(),
  verified: z.boolean().optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    organization_id: z.string().optional(),
    name: z.string(),
    enrollment_mode: EnrollmentModeSchema.optional(),
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

export const updateOrganizationDomainOutputSchema = ResourceSchema;

export function updateOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_organization_domain',
    description: 'Update a verified domain for a Clerk organization.',
    inputSchema: updateOrganizationDomainInputSchema,
    outputSchema: updateOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Domains#operation/UpdateOrganizationDomain
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/domains/${encodeURIComponent(input.domain_id)}`,
        data: {
          ...(input.enrollment_mode !== undefined && { enrollment_mode: input.enrollment_mode }),
          ...(input.verified !== undefined && { verified: input.verified }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
