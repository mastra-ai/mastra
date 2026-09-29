// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateOrganizationRoleInputSchema = z.object({
  organization_role_id: z.string(),
  name: z.string().optional(),
  key: z.string().optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
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

export const updateOrganizationRoleOutputSchema = ResourceSchema;

export function updateOrganizationRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_update_organization_role',
    description: 'Update a Clerk organization role.',
    inputSchema: updateOrganizationRoleInputSchema,
    outputSchema: updateOrganizationRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateOrganizationRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.patch({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Roles#operation/UpdateOrganizationRole
        endpoint: `/v1/organization_roles/${encodeURIComponent(input.organization_role_id)}`,
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.key !== undefined && { key: input.key }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.permissions !== undefined && { permissions: input.permissions }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
