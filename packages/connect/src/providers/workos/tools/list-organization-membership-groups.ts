// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listOrganizationMembershipGroupsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  cursor_direction: z.enum(['after', 'before']).optional().describe('Direction for the cursor. Defaults to after.'),
  limit: z.number().int().min(1).max(100).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  membership_id: z.string(),
});

const ResourceSchema = z
  .object({ id: z.string(), name: z.string(), organization_id: z.string().optional() })
  .passthrough();

const ProviderResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(ResourceSchema),
  list_metadata: z.object({ after: z.string().nullable().optional(), before: z.string().nullable().optional() }),
});

export const listOrganizationMembershipGroupsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
});

export function listOrganizationMembershipGroupsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_list_organization_membership_groups',
    description: 'List groups assigned to a WorkOS organization membership.',
    inputSchema: listOrganizationMembershipGroupsInputSchema,
    outputSchema: listOrganizationMembershipGroupsOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof listOrganizationMembershipGroupsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorDirection = input.cursor_direction ?? 'after';
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/user-management/organization-membership
        endpoint: `/user_management/organization_memberships/${encodeURIComponent(input.membership_id)}/groups`,
        params: {
          ...(input.cursor !== undefined && { [cursorDirection]: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order !== undefined && { order: input.order }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextCursor = cursorDirection === 'before' ? provider.list_metadata.before : provider.list_metadata.after;
      return { items: provider.data, ...(nextCursor != null && { next_cursor: nextCursor }) };
    },
  });
}
