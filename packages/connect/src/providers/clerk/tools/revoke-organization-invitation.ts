// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const revokeOrganizationInvitationInputSchema = z.object({
  organization_id: z.string(),
  invitation_id: z.string(),
  requesting_user_id: z.string().optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    email_address: z.string(),
    organization_id: z.string().optional(),
    role: z.string().optional(),
    status: z.enum(['pending', 'accepted', 'revoked', 'expired']).optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const revokeOrganizationInvitationOutputSchema = ResourceSchema;

export function revokeOrganizationInvitationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_revoke_organization_invitation',
    description: 'Revoke a Clerk organization invitation.',
    inputSchema: revokeOrganizationInvitationInputSchema,
    outputSchema: revokeOrganizationInvitationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof revokeOrganizationInvitationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Invitations#operation/RevokeOrganizationInvitation
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/invitations/${encodeURIComponent(input.invitation_id)}/revoke`,
        data: { ...(input.requesting_user_id !== undefined && { requesting_user_id: input.requesting_user_id }) },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
