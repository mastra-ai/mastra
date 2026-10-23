// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createInvitationInputSchema = z.object({
  email: z.string().email(),
  organization_id: z.string().optional(),
  role_slug: z.string().optional(),
  expires_in_days: z.number().int().min(1).max(30).optional(),
  inviter_user_id: z.string().optional(),
  locale: z.string().optional(),
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

export const createInvitationOutputSchema = ResourceSchema;

export function createInvitationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_create_invitation',
    description: 'Create a WorkOS user invitation.',
    inputSchema: createInvitationInputSchema,
    outputSchema: createInvitationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createInvitationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/user-management/invitation
        endpoint: '/user_management/invitations',
        data: {
          email: input.email,
          ...(input.organization_id !== undefined && { organization_id: input.organization_id }),
          ...(input.role_slug !== undefined && { role_slug: input.role_slug }),
          ...(input.expires_in_days !== undefined && { expires_in_days: input.expires_in_days }),
          ...(input.inviter_user_id !== undefined && { inviter_user_id: input.inviter_user_id }),
          ...(input.locale !== undefined && { locale: input.locale }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
