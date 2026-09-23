// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrganizationInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  created_by: z.string().optional(),
  max_allowed_memberships: z.number().int().min(0).optional(),
  public_metadata: z.record(z.string(), z.unknown()).optional(),
  private_metadata: z.record(z.string(), z.unknown()).optional(),
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

export const createOrganizationOutputSchema = OrganizationSchema;

export function createOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_organization',
    description: 'Create an organization in Clerk.',
    inputSchema: createOrganizationInputSchema,
    outputSchema: createOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organizations#operation/CreateOrganization
        endpoint: '/v1/organizations',
        data: {
          name: input.name,
          ...(input.slug !== undefined && { slug: input.slug }),
          ...(input.created_by !== undefined && { created_by: input.created_by }),
          ...(input.max_allowed_memberships !== undefined && {
            max_allowed_memberships: input.max_allowed_memberships,
          }),
          ...(input.public_metadata !== undefined && { public_metadata: input.public_metadata }),
          ...(input.private_metadata !== undefined && { private_metadata: input.private_metadata }),
        },
        retries: 3,
      });
      return OrganizationSchema.parse(response.data);
    },
  });
}
