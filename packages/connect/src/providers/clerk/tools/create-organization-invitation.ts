// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrganizationInvitationInputSchema = z.object({
  organization_id: z.string(),
  email_address: z.string().email(),
  role: z.string(),
  inviter_user_id: z.string().optional(),
  redirect_url: z.string().url().optional(),
  expires_in_days: z.number().int().positive().optional(),
  notify: z.boolean().optional(),
  public_metadata: z.record(z.string(), z.unknown()).optional(),
  private_metadata: z.record(z.string(), z.unknown()).optional(),
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

export const createOrganizationInvitationOutputSchema = ResourceSchema;

export function createOrganizationInvitationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_create_organization_invitation',
    description: 'Create an invitation for a Clerk organization.',
    inputSchema: createOrganizationInvitationInputSchema,
    outputSchema: createOrganizationInvitationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationInvitationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Invitations#operation/CreateOrganizationInvitation
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/invitations`,
        data: {
          email_address: input.email_address,
          role: input.role,
          ...(input.inviter_user_id !== undefined && { inviter_user_id: input.inviter_user_id }),
          ...(input.redirect_url !== undefined && { redirect_url: input.redirect_url }),
          ...(input.expires_in_days !== undefined && { expires_in_days: input.expires_in_days }),
          ...(input.notify !== undefined && { notify: input.notify }),
          ...(input.public_metadata !== undefined && { public_metadata: input.public_metadata }),
          ...(input.private_metadata !== undefined && { private_metadata: input.private_metadata }),
        },
        retries: 3,
      });
      return ResourceSchema.parse(response.data);
    },
  });
}
