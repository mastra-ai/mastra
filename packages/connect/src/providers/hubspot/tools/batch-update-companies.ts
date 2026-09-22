// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CompanyUpdateSchema = z.object({
  id: z.string().describe('The HubSpot company ID. Example: "123456789"'),
  name: z.string().optional().describe('The company name.'),
  domain: z.string().optional().describe('The company domain.'),
  industry: z.string().optional().describe('The industry the company operates in.'),
  city: z.string().optional().describe('The city where the company is located.'),
  state: z.string().optional().describe('The state where the company is located.'),
  country: z.string().optional().describe('The country where the company is located.'),
  phone: z.string().optional().describe('The company phone number.'),
  website: z.string().optional().describe('The company website URL.'),
});

export const batchUpdateCompaniesInputSchema = z.object({
  companies: z
    .array(CompanyUpdateSchema)
    .min(1)
    .max(100)
    .describe('Array of companies to update (max 100 per request).'),
});

const CompanyResultSchema = z.object({
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

export const batchUpdateCompaniesOutputSchema = z.object({
  results: z.array(CompanyResultSchema),
  status: z.string(),
});

export function batchUpdateCompaniesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_batch_update_companies',
    description: 'Update multiple companies at once',
    inputSchema: batchUpdateCompaniesInputSchema,
    outputSchema: batchUpdateCompaniesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchUpdateCompaniesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build the inputs array for HubSpot API
      const inputs = input.companies.map(company => {
        const properties: Record<string, string> = {};

        if (company.name) properties['name'] = company.name;
        if (company.domain) properties['domain'] = company.domain;
        if (company.industry) properties['industry'] = company.industry;
        if (company.city) properties['city'] = company.city;
        if (company.state) properties['state'] = company.state;
        if (company.country) properties['country'] = company.country;
        if (company.phone) properties['phone'] = company.phone;
        if (company.website) properties['website'] = company.website;

        return {
          id: company.id,
          properties,
        };
      });

      // https://developers.hubspot.com/docs/api-reference/crm-companies-v3/batch/post-crm-v3-objects-companies-batch-update
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/companies/batch/update',
        data: { inputs },
        retries: 3,
      });

      const data = response.data;

      // Map the results
      const results =
        data.results?.map((result: any) => ({
          id: result.id,
          name: result.properties?.['name'] ?? undefined,
          domain: result.properties?.['domain'] ?? undefined,
          industry: result.properties?.['industry'] ?? undefined,
          city: result.properties?.['city'] ?? undefined,
          state: result.properties?.['state'] ?? undefined,
          country: result.properties?.['country'] ?? undefined,
          phone: result.properties?.['phone'] ?? undefined,
          website: result.properties?.['website'] ?? undefined,
          createdAt: result.createdAt ?? undefined,
          updatedAt: result.updatedAt ?? undefined,
        })) || [];

      return {
        results,
        status: data.status || 'COMPLETE',
      };
    },
  });
}
