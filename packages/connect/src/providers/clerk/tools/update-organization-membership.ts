// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateOrganizationMembershipInputSchema = z.object({
  organization_id: z.string(),
  user_id: z.string(),
  role: z.string(),
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

export const updateOrganizationMembershipOutputSchema = ResourceSchema;

export function updateOrganizationMembershipTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_organization_membership',
    description: 'Update a Clerk organization membership role.',
    inputSchema: updateOrganizationMembershipInputSchema,
    outputSchema: updateOrganizationMembershipOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateOrganizationMembershipOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Memberships#operation/UpdateOrganizationMembership
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/memberships/${encodeURIComponent(input.user_id)}`,
        data: { role: input.role },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
