// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrganizationRoleInputSchema = z.object({
  name: z.string(),
  key: z.string(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  include_in_initial_role_set: z.boolean().optional(),
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

export const createOrganizationRoleOutputSchema = ResourceSchema;

export function createOrganizationRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_organization_role',
    description: 'Create a Clerk organization role.',
    inputSchema: createOrganizationRoleInputSchema,
    outputSchema: createOrganizationRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Roles#operation/CreateOrganizationRole
        endpoint: '/v1/organization_roles',
        data: {
          name: input.name,
          key: input.key,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.permissions !== undefined && { permissions: input.permissions }),
          ...(input.include_in_initial_role_set !== undefined && {
            include_in_initial_role_set: input.include_in_initial_role_set,
          }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
