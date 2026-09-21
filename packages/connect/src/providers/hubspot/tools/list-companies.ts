// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listCompaniesInputSchema = z.object({
  cursor: z.string().optional().describe('Pagination cursor from previous response. Omit for first page.'),
});

const CompanySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const listCompaniesOutputSchema = z.object({
  items: z.array(CompanySchema),
  nextCursor: z.string().optional(),
});

export function listCompaniesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_list_companies',
    description: 'List company records',
    inputSchema: listCompaniesInputSchema,
    outputSchema: listCompaniesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listCompaniesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/companies
      const response = await platformProxy.get({
        endpoint: '/crm/v3/objects/companies',
        params: {
          properties: 'name,domain,industry,city,state,country,phone,website,createdate,hs_lastmodifieddate',
          limit: '100',
          ...(input.cursor && { after: input.cursor }),
        },
        retries: 3,
      });

      const companies = response.data.results || [];
      const paging = response.data.paging;

      const items = companies.map((company: any) => ({
        id: company.id,
        name: company.properties?.['name'] ?? undefined,
        domain: company.properties?.['domain'] ?? undefined,
        industry: company.properties?.['industry'] ?? undefined,
        city: company.properties?.['city'] ?? undefined,
        state: company.properties?.['state'] ?? undefined,
        country: company.properties?.['country'] ?? undefined,
        phone: company.properties?.['phone'] ?? undefined,
        website: company.properties?.['website'] ?? undefined,
        createdAt: company.properties?.['createdate'] ?? undefined,
        updatedAt: company.properties?.['hs_lastmodifieddate'] ?? undefined,
      }));

      return {
        items,
        nextCursor: paging?.next?.after || undefined,
      };
    },
  });
}
