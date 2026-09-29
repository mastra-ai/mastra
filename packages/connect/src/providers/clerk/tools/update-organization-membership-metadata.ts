// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateOrganizationMembershipMetadataInputSchema = z.object({
  organization_id: z.string(),
  user_id: z.string(),
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

export const updateOrganizationMembershipMetadataOutputSchema = ResourceSchema;

export function updateOrganizationMembershipMetadataTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_organization_membership_metadata',
    description: 'Update metadata for a Clerk organization membership.',
    inputSchema: updateOrganizationMembershipMetadataInputSchema,
    outputSchema: updateOrganizationMembershipMetadataOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof updateOrganizationMembershipMetadataOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Memberships#operation/UpdateOrganizationMembershipMetadata
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/memberships/${encodeURIComponent(input.user_id)}/metadata`,
        data: {
          ...(input.public_metadata !== undefined && { public_metadata: input.public_metadata }),
          ...(input.private_metadata !== undefined && { private_metadata: input.private_metadata }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
