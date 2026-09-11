// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const revokeInvitationInputSchema = z.object({ invitation_id: z.string() });

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

export const revokeInvitationOutputSchema = ResourceSchema;

export function revokeInvitationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_revoke_invitation',
    description: 'Revoke a WorkOS user invitation.',
    inputSchema: revokeInvitationInputSchema,
    outputSchema: revokeInvitationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof revokeInvitationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://workos.com/docs/reference/user-management/invitation
        endpoint: `/user_management/invitations/${encodeURIComponent(input.invitation_id)}/revoke`,
        data: {},
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
