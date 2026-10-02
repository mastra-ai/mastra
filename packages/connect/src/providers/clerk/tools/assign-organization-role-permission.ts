// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const assignOrganizationRolePermissionInputSchema = z.object({
  organization_role_id: z.string(),
  permission_id: z.string(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    name: z.string(),
    key: z.string(),
    description: z.string().nullable().optional(),
    permissions: z
      .array(z.object({ id: z.string(), key: z.string().optional(), name: z.string().optional() }).passthrough())
      .optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const assignOrganizationRolePermissionOutputSchema = ResourceSchema;

export function assignOrganizationRolePermissionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_assign_organization_role_permission',
    description: 'Assign a permission to a Clerk organization role.',
    inputSchema: assignOrganizationRolePermissionInputSchema,
    outputSchema: assignOrganizationRolePermissionOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof assignOrganizationRolePermissionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Roles#operation/AssignPermissionToOrganizationRole
        endpoint: `/v1/organization_roles/${encodeURIComponent(input.organization_role_id)}/permissions/${encodeURIComponent(input.permission_id)}`,
        data: {},
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
