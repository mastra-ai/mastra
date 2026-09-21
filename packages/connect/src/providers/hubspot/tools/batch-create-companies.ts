// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CompanyInputSchema = z.object({
  name: z.string().optional().describe('Company name. Example: "Acme Inc"'),
  domain: z.string().optional().describe('Company domain. Example: "acme.com"'),
  city: z.string().optional().describe('City. Example: "San Francisco"'),
  industry: z.string().optional().describe('Industry. Example: "Technology"'),
});

export const batchCreateCompaniesInputSchema = z.object({
  companies: z.array(CompanyInputSchema).describe('Array of companies to create'),
});

const CompanyOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const batchCreateCompaniesOutputSchema = z.object({
  companies: z.array(CompanyOutputSchema),
});

export function batchCreateCompaniesTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_batch_create_companies',
    description: 'Create multiple companies at once',
    inputSchema: batchCreateCompaniesInputSchema,
    outputSchema: batchCreateCompaniesOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchCreateCompaniesOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const inputs = input.companies.map(company => {
        const properties: Record<string, string> = {};
        if (company.name) properties['name'] = company.name;
        if (company.domain) properties['domain'] = company.domain;
        if (company.city) properties['city'] = company.city;
        if (company.industry) properties['industry'] = company.industry;
        return { properties };
      });

      // https://developers.hubspot.com/docs/api/crm/companies
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/companies/batch/create',
        data: { inputs },
        retries: 3,
      });

      const results = response.data.results || [];
      const companies = results.map((result: any) => ({
        id: result.id,
        name: result.properties?.['name'] ?? undefined,
        domain: result.properties?.['domain'] ?? undefined,
        city: result.properties?.['city'] ?? undefined,
        industry: result.properties?.['industry'] ?? undefined,
        createdAt: result.createdAt ?? undefined,
        updatedAt: result.updatedAt ?? undefined,
      }));

      return { companies };
    },
  });
}
