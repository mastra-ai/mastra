// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrganizationMembershipInputSchema = z.object({
  organization_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  public_metadata: z.record(z.string(), z.unknown()).optional(),
  private_metadata: z.record(z.string(), z.unknown()).optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    organization: z.object({ id: z.string() }).passthrough().optional(),
    public_user_data: z.object({ user_id: z.string() }).passthrough().optional(),
    role: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const createOrganizationMembershipOutputSchema = ResourceSchema;

export function createOrganizationMembershipTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_organization_membership',
    description: 'Create a membership in a Clerk organization.',
    inputSchema: createOrganizationMembershipInputSchema,
    outputSchema: createOrganizationMembershipOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationMembershipOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Memberships#operation/CreateOrganizationMembership
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/memberships`,
        data: {
          user_id: input.user_id,
          role: input.role,
          ...(input.public_metadata !== undefined && { public_metadata: input.public_metadata }),
          ...(input.private_metadata !== undefined && { private_metadata: input.private_metadata }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
