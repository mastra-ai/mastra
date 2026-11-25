// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getOrganizationInputSchema = z.object({
  organization_id: z.number().describe('The ID of the organization to retrieve. Example: 35436'),
});

const ProviderOrganizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  details: z.string().nullable().optional(),
  domain_names: z.array(z.string()).optional(),
  external_id: z.string().nullable().optional(),
  group_id: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  organization_fields: z.record(z.string(), z.unknown()).optional(),
  shared_comments: z.boolean().optional(),
  shared_tickets: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().optional(),
});

export const getOrganizationOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  details: z.string().optional(),
  domain_names: z.array(z.string()).optional(),
  external_id: z.string().optional(),
  group_id: z.number().optional(),
  notes: z.string().optional(),
  organization_fields: z.record(z.string(), z.unknown()).optional(),
  shared_comments: z.boolean().optional(),
  shared_tickets: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().optional(),
});

export function getOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_get_organization',
    description: 'Retrieve an organization by ID.',
    inputSchema: getOrganizationInputSchema,
    outputSchema: getOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developer.zendesk.com/api-reference/ticketing/organizations/organizations/#show-organization
      const response = await platformProxy.get({
        endpoint: `/api/v2/organizations/${encodeURIComponent(input.organization_id)}.json`,
        retries: 3,
      });

      if (!response.data || !response.data.organization) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Organization not found',
          organization_id: input.organization_id,
        });
      }

      const providerOrg = ProviderOrganizationSchema.parse(response.data.organization);

      return {
        id: providerOrg.id,
        name: providerOrg.name,
        ...(providerOrg.created_at !== undefined && { created_at: providerOrg.created_at }),
        ...(providerOrg.updated_at !== undefined && { updated_at: providerOrg.updated_at }),
        ...(providerOrg.details != null && { details: providerOrg.details }),
        ...(providerOrg.domain_names !== undefined && { domain_names: providerOrg.domain_names }),
        ...(providerOrg.external_id != null && { external_id: providerOrg.external_id }),
        ...(providerOrg.group_id != null && { group_id: providerOrg.group_id }),
        ...(providerOrg.notes != null && { notes: providerOrg.notes }),
        ...(providerOrg.organization_fields !== undefined && { organization_fields: providerOrg.organization_fields }),
        ...(providerOrg.shared_comments !== undefined && { shared_comments: providerOrg.shared_comments }),
        ...(providerOrg.shared_tickets !== undefined && { shared_tickets: providerOrg.shared_tickets }),
        ...(providerOrg.tags !== undefined && { tags: providerOrg.tags }),
        ...(providerOrg.url !== undefined && { url: providerOrg.url }),
      };
    },
  });
}
