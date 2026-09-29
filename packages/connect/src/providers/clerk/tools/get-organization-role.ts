// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOrganizationRoleInputSchema = z.object({ organization_role_id: z.string() });

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

export const getOrganizationRoleOutputSchema = ResourceSchema;

export function getOrganizationRoleTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_organization_role',
    description: 'Get a Clerk organization role.',
    inputSchema: getOrganizationRoleInputSchema,
    outputSchema: getOrganizationRoleOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOrganizationRoleOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Roles#operation/GetOrganizationRole
        endpoint: `/v1/organization_roles/${encodeURIComponent(input.organization_role_id)}`,
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
