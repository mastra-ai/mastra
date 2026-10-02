// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listInvitationsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  cursor_direction: z.enum(['after', 'before']).optional().describe('Direction for the cursor. Defaults to after.'),
  limit: z.number().int().min(1).max(100).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  organization_id: z.string().optional(),
  email: z.string().email().optional(),
});

const ResourceSchema = z
  .object({
    object: z.literal('invitation'),
    id: z.string(),
    email: z.string(),
    state: z.enum(['pending', 'accepted', 'expired', 'revoked']),
    accepted_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
    expires_at: z.string(),
    organization_id: z.string().nullable(),
    inviter_user_id: z.string().nullable(),
    accepted_user_id: z.string().nullable(),
    role_slug: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    token: z.string(),
    accept_invitation_url: z.string(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({
  object: z.literal('list').optional(),
  data: z.array(ResourceSchema),
  list_metadata: z.object({ after: z.string().nullable().optional(), before: z.string().nullable().optional() }),
});

export const listInvitationsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
});

export function listInvitationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_list_invitations',
    description: 'List WorkOS user invitations.',
    inputSchema: listInvitationsInputSchema,
    outputSchema: listInvitationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listInvitationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const cursorDirection = input.cursor_direction ?? 'after';
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/user-management/invitation
        endpoint: '/user_management/invitations',
        params: {
          ...(input.cursor !== undefined && { [cursorDirection]: input.cursor }),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.order !== undefined && { order: input.order }),
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
          ...(input.email !== undefined && { email: input.email }),
        },
        retries: 3,
      });
      const provider = ProviderResponseSchema.parse(response.data);
      const nextCursor = cursorDirection === 'before' ? provider.list_metadata.before : provider.list_metadata.after;
      return { items: provider.data, ...(nextCursor != null && { next_cursor: nextCursor }) };
    },
  });
}
