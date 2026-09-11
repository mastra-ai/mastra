// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const removeOrganizationRolePermissionInputSchema = z.object({
  organization_role_id: z.string(),
  permission_id: z.string(),
});

export const removeOrganizationRolePermissionOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function removeOrganizationRolePermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_remove_organization_role_permission',
    description: 'Remove a permission from a Clerk organization role.',
    inputSchema: removeOrganizationRolePermissionInputSchema,
    outputSchema: removeOrganizationRolePermissionOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof removeOrganizationRolePermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Roles#operation/RemovePermissionFromOrganizationRole
        endpoint: `/v1/organization_roles/${encodeURIComponent(input.organization_role_id)}/permissions/${encodeURIComponent(input.permission_id)}`,
        retries: 3,
      });
      return { id: input.permission_id, success: true };
    },
  });
}
