// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listOrganizationsInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from the previous response. Omit for the first page.'),
});

const ProviderOrganizationSchema = z
  .object({
    id: z.number(),
    name: z.string().optional(),
    url: z.string().optional(),
    external_id: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    domain_names: z.array(z.string()).optional(),
    details: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    group_id: z.number().nullable().optional(),
    shared_tickets: z.boolean().optional(),
    shared_comments: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough()
  .catchall(z.unknown());

const ProviderListResponseSchema = z.object({
  organizations: z.array(ProviderOrganizationSchema),
  next_page: z.string().nullable().optional(),
  previous_page: z.string().nullable().optional(),
  count: z.number().optional(),
});

const OrganizationOutputSchema = z
  .object({
    id: z.number(),
    name: z.string().optional(),
    url: z.string().optional(),
    external_id: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    domain_names: z.array(z.string()).optional(),
    details: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    group_id: z.number().nullable().optional(),
    shared_tickets: z.boolean().optional(),
    shared_comments: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough()
  .catchall(z.unknown());

export const listOrganizationsOutputSchema = z.object({
  items: z.array(OrganizationOutputSchema),
  next_cursor: z.string().optional(),
});

function extractCursorFromNextPageUrl(nextPageUrl: string | null | undefined): string | undefined {
  if (!nextPageUrl) {
    return undefined;
  }
  // @allowTryCatch URL parsing can fail with malformed URLs from the API
  try {
    const urlObj = new URL(nextPageUrl);
    const page = urlObj.searchParams.get('page');
    if (page) {
      return page;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function mapOrganization(org: z.infer<typeof ProviderOrganizationSchema>): z.infer<typeof OrganizationOutputSchema> {
  return {
    id: org.id,
    ...(org.name !== undefined && { name: org.name }),
    ...(org.url !== undefined && { url: org.url }),
    ...(org.external_id !== undefined && { external_id: org.external_id }),
    ...(org.created_at !== undefined && { created_at: org.created_at }),
    ...(org.updated_at !== undefined && { updated_at: org.updated_at }),
    ...(org.domain_names !== undefined && { domain_names: org.domain_names }),
    ...(org.details !== undefined && { details: org.details }),
    ...(org.notes !== undefined && { notes: org.notes }),
    ...(org.group_id !== undefined && { group_id: org.group_id }),
    ...(org.shared_tickets !== undefined && { shared_tickets: org.shared_tickets }),
    ...(org.shared_comments !== undefined && { shared_comments: org.shared_comments }),
    ...(org.tags !== undefined && { tags: org.tags }),
  };
}

export function listOrganizationsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'zendesk_list_organizations',
    description: 'List organizations in Zendesk Support.',
    inputSchema: listOrganizationsInputSchema,
    outputSchema: listOrganizationsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listOrganizationsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input.cursor) {
        params['page'] = input.cursor;
      }

      // https://developer.zendesk.com/api-reference/ticketing/organizations/organizations/#list-organizations
      const response = await platformProxy.get({
        endpoint: '/api/v2/organizations.json',
        params,
        retries: 3,
      });

      const parsedData = ProviderListResponseSchema.parse(response.data);

      return {
        items: parsedData.organizations.map(mapOrganization),
        ...(extractCursorFromNextPageUrl(parsedData.next_page) && {
          next_cursor: extractCursorFromNextPageUrl(parsedData.next_page),
        }),
      };
    },
  });
}
