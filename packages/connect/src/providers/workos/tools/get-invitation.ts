// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getInvitationInputSchema = z.object({ invitation_id: z.string() });

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

export const getInvitationOutputSchema = ResourceSchema;

export function getInvitationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'workos_get_invitation',
    description: 'Get a WorkOS user invitation.',
    inputSchema: getInvitationInputSchema,
    outputSchema: getInvitationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getInvitationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://workos.com/docs/reference/user-management/invitation
        endpoint: `/user_management/invitations/${encodeURIComponent(input.invitation_id)}`,

        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
