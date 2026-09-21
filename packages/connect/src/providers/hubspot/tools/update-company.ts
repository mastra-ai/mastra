// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateCompanyInputSchema = z.object({
  id: z.string().describe('HubSpot company ID. Example: "123456789"'),
  name: z.string().optional().describe('Company name'),
  domain: z.string().optional().describe('Company domain'),
  city: z.string().optional().describe('City'),
  state: z.string().optional().describe('State/Region'),
  country: z.string().optional().describe('Country'),
  industry: z.string().optional().describe('Industry'),
  phone: z.string().optional().describe('Phone number'),
  website: z.string().optional().describe('Website URL'),
  description: z.string().optional().describe('Company description'),
});

export const updateCompanyOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function updateCompanyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_update_company',
    description: 'Update a company record',
    inputSchema: updateCompanyInputSchema,
    outputSchema: updateCompanyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCompanyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const properties: Record<string, string> = {};

      // Presence check, not truthiness: HubSpot clears a property when sent '',
      // so an explicitly-supplied empty string must reach the request body.
      if (input.name !== undefined) properties['name'] = input.name;
      if (input.domain !== undefined) properties['domain'] = input.domain;
      if (input.city !== undefined) properties['city'] = input.city;
      if (input.state !== undefined) properties['state'] = input.state;
      if (input.country !== undefined) properties['country'] = input.country;
      if (input.industry !== undefined) properties['industry'] = input.industry;
      if (input.phone !== undefined) properties['phone'] = input.phone;
      if (input.website !== undefined) properties['website'] = input.website;
      if (input.description !== undefined) properties['description'] = input.description;

      // https://developers.hubspot.com/docs/api-reference/crm-companies-v3/basic/patch-crm-v3-objects-companies-companyId
      const response = await platformProxy.patch({
        endpoint: `/crm/v3/objects/companies/${input.id}`,
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        name: data.properties?.['name'] ?? undefined,
        domain: data.properties?.['domain'] ?? undefined,
        city: data.properties?.['city'] ?? undefined,
        state: data.properties?.['state'] ?? undefined,
        country: data.properties?.['country'] ?? undefined,
        industry: data.properties?.['industry'] ?? undefined,
        phone: data.properties?.['phone'] ?? undefined,
        website: data.properties?.['website'] ?? undefined,
        description: data.properties?.['description'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
