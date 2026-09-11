// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationMembershipInputSchema = z.object({ membership_id: z.string() });

export const deleteOrganizationMembershipOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationMembershipTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_delete_organization_membership',
    description: 'Delete a WorkOS organization membership.',
    inputSchema: deleteOrganizationMembershipInputSchema,
    outputSchema: deleteOrganizationMembershipOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationMembershipOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://workos.com/docs/reference/user-management/organization-membership
        endpoint: `/user_management/organization_memberships/${encodeURIComponent(input.membership_id)}`,
        retries: 3,
      });
      return { id: input.membership_id, success: true };
    },
  });
}
