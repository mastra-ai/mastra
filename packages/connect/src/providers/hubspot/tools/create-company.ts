// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createCompanyInputSchema = z.object({
  name: z.string().optional().describe('Company name. Example: "Acme Inc."'),
  domain: z.string().optional().describe('Company domain. Example: "acme.com"'),
  city: z.string().optional().describe('Company city. Example: "San Francisco"'),
  industry: z.string().optional().describe('Company industry. Example: "Software"'),
  phone: z.string().optional().describe('Company phone number. Example: "+1-555-1234"'),
  website: z.string().optional().describe('Company website URL. Example: "https://acme.com"'),
});

export const createCompanyOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  city: z.string().optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function createCompanyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_create_company',
    description: 'Create a company record',
    inputSchema: createCompanyInputSchema,
    outputSchema: createCompanyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCompanyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {};

      if (input.name) properties['name'] = input.name;
      if (input.domain) properties['domain'] = input.domain;
      if (input.city) properties['city'] = input.city;
      if (input.industry) properties['industry'] = input.industry;
      if (input.phone) properties['phone'] = input.phone;
      if (input.website) properties['website'] = input.website;

      // https://developers.hubspot.com/docs/api-reference/crm/objects/companies#create-companies
      const response = await platformProxy.post({
        endpoint: '/crm/v3/objects/companies',
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        name: data.properties?.['name'] ?? undefined,
        domain: data.properties?.['domain'] ?? undefined,
        city: data.properties?.['city'] ?? undefined,
        industry: data.properties?.['industry'] ?? undefined,
        phone: data.properties?.['phone'] ?? undefined,
        website: data.properties?.['website'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
