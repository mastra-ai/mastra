// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listOrganizationMembershipsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  limit: z.number().int().min(1).max(500).optional(),
  organization_id: z.string(),
  user_id: z.array(z.string()).optional(),
  email_address: z.array(z.string()).optional(),
  phone_number: z.array(z.string()).optional(),
  username: z.array(z.string()).optional(),
  web3_wallet: z.array(z.string()).optional(),
  role: z.array(z.string()).optional(),
  query: z.string().optional(),
  email_address_query: z.string().optional(),
  phone_number_query: z.string().optional(),
  username_query: z.string().optional(),
  name_query: z.string().optional(),
  last_active_at_before: z.number().int().optional(),
  last_active_at_after: z.number().int().optional(),
  created_at_before: z.number().int().optional(),
  created_at_after: z.number().int().optional(),
  order_by: z.string().optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    organization: z.object({ id: z.string() }).passthrough().optional(),
    public_user_data: z.object({ user_id: z.string() }).passthrough().optional(),
    role: z.string().optional(),
    permissions: z.array(z.string()).optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ data: z.array(ResourceSchema), total_count: z.number() });

export const listOrganizationMembershipsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
  total: z.number(),
});

export function listOrganizationMembershipsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_list_organization_memberships',
    description: 'List memberships for a Clerk organization.',
    inputSchema: listOrganizationMembershipsInputSchema,
    outputSchema: listOrganizationMembershipsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOrganizationMembershipsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor === undefined ? 0 : Number.parseInt(input.cursor, 10);
      if (!Number.isInteger(offset) || offset < 0)
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'Cursor must be a non-negative integer.',
        });
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Memberships#operation/ListOrganizationMemberships
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/memberships`,
        params: {
          offset: String(offset),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.user_id !== undefined && { user_id: input.user_id }),
          ...(input.email_address !== undefined && { email_address: input.email_address }),
          ...(input.phone_number !== undefined && { phone_number: input.phone_number }),
          ...(input.username !== undefined && { username: input.username }),
          ...(input.web3_wallet !== undefined && { web3_wallet: input.web3_wallet }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.query !== undefined && { query: input.query }),
          ...(input.email_address_query !== undefined && { email_address_query: input.email_address_query }),
          ...(input.phone_number_query !== undefined && { phone_number_query: input.phone_number_query }),
          ...(input.username_query !== undefined && { username_query: input.username_query }),
          ...(input.name_query !== undefined && { name_query: input.name_query }),
          ...(input.last_active_at_before !== undefined && {
            last_active_at_before: String(input.last_active_at_before),
          }),
          ...(input.last_active_at_after !== undefined && { last_active_at_after: String(input.last_active_at_after) }),
          ...(input.created_at_before !== undefined && { created_at_before: String(input.created_at_before) }),
          ...(input.created_at_after !== undefined && { created_at_after: String(input.created_at_after) }),
          ...(input.order_by !== undefined && { order_by: input.order_by }),
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
