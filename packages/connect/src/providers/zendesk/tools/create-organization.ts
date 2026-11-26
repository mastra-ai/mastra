// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createOrganizationInputSchema = z.object({
  name: z.string(),
  notes: z.string().optional(),
  details: z.string().optional(),
  external_id: z.string().optional(),
  domain_names: z.array(z.string()).optional(),
  group_id: z.number().optional(),
  shared_tickets: z.boolean().optional(),
  shared_comments: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  organization_fields: z.record(z.string(), z.unknown()).optional(),
});

const OrganizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  notes: z.string().nullable(),
  details: z.string().nullable(),
  external_id: z.string().nullable(),
  domain_names: z.array(z.string()),
  group_id: z.number().nullable(),
  shared_tickets: z.boolean(),
  shared_comments: z.boolean(),
  tags: z.array(z.string()),
  organization_fields: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createOrganizationOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  notes: z.string().optional(),
  details: z.string().optional(),
  external_id: z.string().optional(),
  domain_names: z.array(z.string()),
  group_id: z.number().optional(),
  shared_tickets: z.boolean(),
  shared_comments: z.boolean(),
  tags: z.array(z.string()),
  organization_fields: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function createOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_create_organization',
    description: 'Create an organization in Zendesk Support',
    inputSchema: createOrganizationInputSchema,
    outputSchema: createOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const payload: Record<string, unknown> = {
        organization: {
          name: input.name,
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.details !== undefined && { details: input.details }),
          ...(input.external_id !== undefined && { external_id: input.external_id }),
          ...(input.domain_names !== undefined && { domain_names: input.domain_names }),
          ...(input.group_id !== undefined && { group_id: input.group_id }),
          ...(input.shared_tickets !== undefined && { shared_tickets: input.shared_tickets }),
          ...(input.shared_comments !== undefined && { shared_comments: input.shared_comments }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.organization_fields !== undefined && { organization_fields: input.organization_fields }),
        },
      };

      // https://developer.zendesk.com/api-reference/ticketing/organizations/organizations/#create-organization
      const response = await platformProxy.post({
        endpoint: '/api/v2/organizations.json',
        data: payload,
        retries: 1,
      });

      const rawOrganization = OrganizationSchema.safeParse(response.data.organization);

      if (!rawOrganization.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Invalid organization response from Zendesk API',
          issues: rawOrganization.error.issues,
        });
      }

      const org = rawOrganization.data;

      return {
        id: org.id,
        name: org.name,
        ...(org.notes != null && { notes: org.notes }),
        ...(org.details != null && { details: org.details }),
        ...(org.external_id != null && { external_id: org.external_id }),
        domain_names: org.domain_names,
        ...(org.group_id != null && { group_id: org.group_id }),
        shared_tickets: org.shared_tickets,
        shared_comments: org.shared_comments,
        tags: org.tags,
        ...(org.organization_fields !== undefined && { organization_fields: org.organization_fields }),
        created_at: org.created_at,
        updated_at: org.updated_at,
      };
    },
  });
}
