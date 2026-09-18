// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const EnrollmentModeSchema = z.enum([
  'manual_invitation',
  'automatic_invitation',
  'automatic_suggestion',
  'enterprise_sso',
]);

export const listOrganizationDomainsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor returned by a previous request. Omit for the first page.'),
  limit: z.number().int().min(1).max(500).optional(),
  organization_id: z.string(),
  verified: z.boolean().optional(),
  enrollment_mode: EnrollmentModeSchema.optional(),
});

const ResourceSchema = z
  .object({
    id: z.string(),
    object: z.string().optional(),
    organization_id: z.string().optional(),
    name: z.string(),
    enrollment_mode: EnrollmentModeSchema.optional(),
    affiliation_verification: z
      .object({ attempts: z.number().optional(), status: z.string().optional() })
      .passthrough()
      .optional(),
    verification: z.object({ attempts: z.number().optional(), status: z.string().optional() }).passthrough().optional(),
    verified: z.boolean().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

const ProviderResponseSchema = z.object({ data: z.array(ResourceSchema), total_count: z.number() });

export const listOrganizationDomainsOutputSchema = z.object({
  items: z.array(ResourceSchema),
  next_cursor: z.string().optional(),
  total: z.number(),
});

export function listOrganizationDomainsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'clerk_list_organization_domains',
    description: 'List verified domains for a Clerk organization.',
    inputSchema: listOrganizationDomainsInputSchema,
    outputSchema: listOrganizationDomainsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOrganizationDomainsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const offset = input.cursor === undefined ? 0 : Number.parseInt(input.cursor, 10);
      if (!Number.isInteger(offset) || offset < 0)
        throw new platformProxy.ActionError({
          type: 'invalid_cursor',
          message: 'Cursor must be a non-negative integer.',
        });
      const response = await platformProxy.get({
        // https://clerk.com/docs/reference/backend-api/tag/Organization-Domains#operation/ListOrganizationDomains
        endpoint: `/v1/organizations/${encodeURIComponent(input.organization_id)}/domains`,
        params: {
          offset: String(offset),
          ...(input.limit !== undefined && { limit: String(input.limit) }),
          ...(input.verified !== undefined && { verified: String(input.verified) }),
          ...(input.enrollment_mode !== undefined && { enrollment_mode: input.enrollment_mode }),
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
