// AUTO-GENERATED from NangoHQ/integration-templates @ 23df553a789b — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deleteOrganizationRoleInputSchema = z.object({ organization_role_id: z.string().min(1) });

export const deleteOrganizationRoleOutputSchema = z.object({ id: z.string(), success: z.boolean() });

export function deleteOrganizationRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_delete_organization_role',
    description: 'Delete a Clerk organization role.',
    inputSchema: deleteOrganizationRoleInputSchema,
    outputSchema: deleteOrganizationRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof deleteOrganizationRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      await platformProxy.delete({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Roles#operation/DeleteOrganizationRole
        endpoint: `/v1/organization_roles/${encodeURIComponent(input.organization_role_id)}`,
        retries: 3,
      });
      return { id: input.organization_role_id, success: true };
    },
  });
}
