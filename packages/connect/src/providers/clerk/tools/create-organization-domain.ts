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

export const createOrganizationDomainInputSchema = z.object({
  organization_id: z.string(),
  name: z.string(),
  enrollment_mode: EnrollmentModeSchema,
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

export const createOrganizationDomainOutputSchema = ResourceSchema;

export function createOrganizationDomainTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_organization_domain',
    description: 'Create a verified domain for a Clerk organization.',
    inputSchema: createOrganizationDomainInputSchema,
    outputSchema: createOrganizationDomainOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationDomainOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Domains#operation/CreateOrganizationDomain
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/domains`,
        data: {
          name: input.name,
          enrollment_mode: input.enrollment_mode,
          ...(input.verified !== undefined && { verified: input.verified }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
