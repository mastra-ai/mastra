// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const deactivateOrganizationMembershipInputSchema = z.object({ membership_id: z.string() });

const ResourceSchema = z
  .object({
    object: z.literal('organization_membership'),
    id: z.string(),
    user_id: z.string(),
    organization_id: z.string(),
    status: z.enum(['active', 'inactive', 'pending']),
    directory_managed: z.boolean(),
    organization_name: z.string().optional(),
    custom_attributes: z.record(z.string(), z.unknown()).optional(),
    role: z.object({ slug: z.string() }).passthrough().optional(),
    roles: z.array(z.object({ slug: z.string() }).passthrough()).optional(),
    user: z.object({ id: z.string() }).passthrough().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const deactivateOrganizationMembershipOutputSchema = ResourceSchema;

export function deactivateOrganizationMembershipTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_deactivate_organization_membership',
    description: 'Deactivate a WorkOS organization membership.',
    inputSchema: deactivateOrganizationMembershipInputSchema,
    outputSchema: deactivateOrganizationMembershipOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof deactivateOrganizationMembershipOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.put({
        // https://workos.com/docs/reference/user-management/organization-membership
        endpoint: `/user_management/organization_memberships/${encodeURIComponent(input.membership_id)}/deactivate`,
        data: {},
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
