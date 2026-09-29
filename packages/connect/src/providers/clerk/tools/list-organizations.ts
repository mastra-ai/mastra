// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listOrganizationsInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  query: z.string().optional(),
  order_by: z.string().optional().describe('Sort by name, created_at, or members_count, prefixed with + or -.'),
  organization_id: z.array(z.string()).max(100).optional(),
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

const ProviderResponseSchema = z.object({ data: z.array(OrganizationSchema), total_count: z.number() });

export const listOrganizationsOutputSchema = z.object({
  items: z.array(OrganizationSchema),
  next_cursor: z.string().optional(),
  total: z.number(),
});

export function listOrganizationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_list_organizations',
    description: 'List organizations from Clerk.',
    inputSchema: listOrganizationsInputSchema,
    outputSchema: listOrganizationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOrganizationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor === undefined ? 0 : Number.parseInt(input.cursor, 10);
      if (!Number.isInteger(offset) || offset < 0)
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'Cursor must be a non-negative integer.',
        });
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Organizations#operation/GetOrganizationList
        endpoint: '/v1/organizations',
        params: {
          offset: String(offset),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.query !== undefined && { query: input.query }),
          ...(input.order_by !== undefined && { order_by: input.order_by }),
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
          ...(input.include_members_count !== undefined && {
            include_members_count: String(input.include_members_count),
          }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextOffset = offset + provider.data.length;
      return {
        items: provider.data,
        ...(nextOffset < provider.total_count && { next_cursor: String(nextOffset) }),
        total: provider.total_count,
      };
    },
  });
}
