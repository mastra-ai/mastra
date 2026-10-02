// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listOrganizationMembershipsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  cursor_direction: z.enum(['after', 'before']).optional().describe('Direction for the cursor. Defaults to after.'),
  limit: z.number().int().min(1).max(100).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  organization_id: z.string().optional(),
  user_id: z.string().optional(),
  statuses: z.array(z.enum(['active', 'inactive', 'pending'])).optional(),
});

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

const ProviderResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(ResourceSchema),
  list_metadata: z.object({ after: z.string().nullable().optional(), before: z.string().nullable().optional() }),
});

export const listOrganizationMembershipsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
});

export function listOrganizationMembershipsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_list_organization_memberships',
    description: 'List WorkOS organization memberships.',
    inputSchema: listOrganizationMembershipsInputSchema,
    outputSchema: listOrganizationMembershipsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOrganizationMembershipsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorDirection = input.cursor_direction ?? 'after';
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/user-management/organization-membership
        endpoint: '/user_management/organization_memberships',
        params: {
          ...(input.cursor !== undefined && { [cursorDirection]: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
          ...(input.user_id !== undefined && { user_id: input.user_id }),
          ...(input.statuses !== undefined && { statuses: input.statuses.join(',') }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextCursor = cursorDirection === 'before' ? provider.list_metadata.before : provider.list_metadata.after;
      return { items: provider.data, ...(nextCursor != null && { next_cursor: nextCursor }) };
    },
  });
}
