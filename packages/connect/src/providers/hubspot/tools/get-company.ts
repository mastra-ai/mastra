// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCompanyInputSchema = z.object({
  id: z.string().describe('Company ID to retrieve'),
});

export const getCompanyOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function getCompanyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_get_company',
    description: 'Get a company by ID',
    inputSchema: getCompanyInputSchema,
    outputSchema: getCompanyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCompanyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/companies
      const response = await platformProxy.get({
        endpoint: `/crm/v3/objects/companies/${input.id}`,
        params: {
          properties: 'name,domain,industry,phone,city,state,country',
        },
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Company not found',
          id: input.id,
        });
      }

      const data = response.data;

      return {
        id: data.id,
        name: data.properties?.['name'] ?? undefined,
        domain: data.properties?.['domain'] ?? undefined,
        industry: data.properties?.['industry'] ?? undefined,
        phone: data.properties?.['phone'] ?? undefined,
        city: data.properties?.['city'] ?? undefined,
        state: data.properties?.['state'] ?? undefined,
        country: data.properties?.['country'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
