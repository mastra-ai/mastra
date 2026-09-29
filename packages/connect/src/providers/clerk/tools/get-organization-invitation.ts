// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOrganizationInvitationInputSchema = z.object({
  organization_id: z.string(),
  invitation_id: z.string(),
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

export const getOrganizationInvitationOutputSchema = ResourceSchema;

export function getOrganizationInvitationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_get_organization_invitation',
    description: 'Get a Clerk organization invitation.',
    inputSchema: getOrganizationInvitationInputSchema,
    outputSchema: getOrganizationInvitationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOrganizationInvitationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Invitations#operation/GetOrganizationInvitation
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/invitations/${encodeURIComponent(input.invitation_id)}`,
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
