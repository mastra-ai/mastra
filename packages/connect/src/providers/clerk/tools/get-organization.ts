// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOrganizationInputSchema = z.object({
  organization_id: z.string().min(1),
  include_members_count: z.boolean().optional(),
});

const OrganizationSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    name: z.string(),
    slug: z.string(),
    image_url: z.string().optional(),
    has_image: z.boolean().optional(),
    members_count: z.number().optional(),
    max_allowed_memberships: z.number().optional(),
    admin_delete_enabled: z.boolean().optional(),
    public_metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    private_metadata: z.record(z.string(), z.unknown()).optional(),
    created_by: z.string().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const getOrganizationOutputSchema = OrganizationSchema;

export function getOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_organization',
    description: 'Retrieve a Clerk organization by ID.',
    inputSchema: getOrganizationInputSchema,
    outputSchema: getOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://clerk.com/docs/reference/backend-api/tag/Organizations#operation/GetOrganization
      const response = await platformProxy.get({
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}`,
        params: {
          ...(input.include_members_count !== undefined && {
            include_members_count: String(input.include_members_count),
          }),
        },
        retries: 3,
      });
      return OrganizationSchema.parse(response.data);
    },
  });
}
