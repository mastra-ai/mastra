// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateOrganizationInputSchema = z.object({
  organizationId: z.number().describe('The ID of the organization to update. Example: 123'),
  name: z.string().optional().describe('A unique name for the organization. Example: "Acme Inc."'),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe('Any notes about the organization. Set to null to clear. Example: "Primary customer"'),
  details: z
    .string()
    .nullable()
    .optional()
    .describe('Any details about the organization, such as the address. Set to null to clear.'),
  external_id: z
    .string()
    .nullable()
    .optional()
    .describe('A unique external ID to associate organizations to an external record. Set to null to clear.'),
  group_id: z
    .number()
    .optional()
    .describe('New tickets from users in this organization are automatically put in this group. Example: 234'),
  shared_tickets: z.boolean().optional().describe("End users in this organization can see each other's tickets."),
  shared_comments: z
    .boolean()
    .optional()
    .describe("End users in this organization can comment on each other's tickets."),
  domain_names: z
    .array(z.string())
    .optional()
    .describe('An array of domain names associated with this organization. Example: ["example.com", "acme.com"]'),
  tags: z.array(z.string()).optional().describe('The tags of the organization. Example: ["vip", "enterprise"]'),
});

const ProviderOrganizationSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  notes: z.string().nullable(),
  details: z.string().nullable(),
  external_id: z.string().nullable(),
  group_id: z.number().nullable(),
  shared_tickets: z.boolean().optional(),
  shared_comments: z.boolean().optional(),
  domain_names: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  url: z.string().optional(),
});

export const updateOrganizationOutputSchema = z.object({
  id: z.number().describe('The ID of the organization'),
  name: z.string().optional(),
  notes: z.string().optional(),
  details: z.string().optional(),
  external_id: z.string().optional(),
  group_id: z.number().optional(),
  shared_tickets: z.boolean().optional(),
  shared_comments: z.boolean().optional(),
  domain_names: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  url: z.string().optional(),
});

export function updateOrganizationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_update_organization',
    description: 'Update an existing organization in Zendesk.',
    inputSchema: updateOrganizationInputSchema,
    outputSchema: updateOrganizationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateOrganizationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, unknown> = {};

      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.notes !== undefined) {
        data['notes'] = input.notes;
      }
      if (input.details !== undefined) {
        data['details'] = input.details;
      }
      if (input.external_id !== undefined) {
        data['external_id'] = input.external_id;
      }
      if (input.group_id !== undefined) {
        data['group_id'] = input.group_id;
      }
      if (input.shared_tickets !== undefined) {
        data['shared_tickets'] = input.shared_tickets;
      }
      if (input.shared_comments !== undefined) {
        data['shared_comments'] = input.shared_comments;
      }
      if (input.domain_names !== undefined) {
        data['domain_names'] = input.domain_names;
      }
      if (input.tags !== undefined) {
        data['tags'] = input.tags;
      }

      // https://developer.zendesk.com/api-reference/ticketing/organizations/organizations/#update-organization
      const response = await platformProxy.put({
        endpoint: `/api/v2/organizations/${encodeURIComponent(input.organizationId)}.json`,
        data: {
          organization: data,
        },
        retries: 1,
      });

      const responseData = z
        .object({
          organization: ProviderOrganizationSchema,
        })
        .parse(response.data);

      const org = responseData.organization;

      return {
        id: org.id,
        ...(org.name !== undefined && { name: org.name }),
        ...(org.notes != null && { notes: org.notes }),
        ...(org.details != null && { details: org.details }),
        ...(org.external_id != null && { external_id: org.external_id }),
        ...(org.group_id != null && { group_id: org.group_id }),
        ...(org.shared_tickets !== undefined && { shared_tickets: org.shared_tickets }),
        ...(org.shared_comments !== undefined && { shared_comments: org.shared_comments }),
        ...(org.domain_names !== undefined && { domain_names: org.domain_names }),
        ...(org.tags !== undefined && { tags: org.tags }),
        ...(org.created_at !== undefined && { created_at: org.created_at }),
        ...(org.updated_at !== undefined && { updated_at: org.updated_at }),
        ...(org.url !== undefined && { url: org.url }),
      };
    },
  });
}
