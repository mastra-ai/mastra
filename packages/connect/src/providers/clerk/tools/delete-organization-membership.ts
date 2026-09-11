// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationMembershipInputSchema = z.object({ organization_id: z.string(), user_id: z.string() });

export const deleteOrganizationMembershipOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationMembershipTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_organization_membership',
    description: 'Delete a membership from a Clerk organization.',
    inputSchema: deleteOrganizationMembershipInputSchema,
    outputSchema: deleteOrganizationMembershipOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationMembershipOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Memberships#operation/DeleteOrganizationMembership
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/memberships/${encodeURIComponent(input.user_id)}`,
        retries: 3,
      });
      return { id: input.user_id, success: true };
    },
  });
}
