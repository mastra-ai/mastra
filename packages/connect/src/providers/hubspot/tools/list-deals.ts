// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listDealsInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor from previous response. Maps to HubSpot "after" parameter.'),
});

const DealSchema = z.object({
  id: z.string(),
  dealname: z.string().optional(),
  dealstage: z.string().optional(),
  pipeline: z.string().optional(),
  amount: z.number().optional(),
  closedate: z.string().optional(),
  createdate: z.string().optional(),
  hs_lastmodifieddate: z.string().optional(),
});

export const listDealsOutputSchema = z.object({
  deals: z.array(DealSchema),
  nextCursor: z.string().optional(),
});

export function listDealsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_list_deals',
    description: 'List deal records from HubSpot CRM',
    inputSchema: listDealsInputSchema,
    outputSchema: listDealsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listDealsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/deals
      const response = await platformProxy.get({
        endpoint: '/crm/v3/objects/deals',
        params: {
          properties: 'dealname,dealstage,pipeline,amount,closedate,createdate,hs_lastmodifieddate',
          limit: '100',
          ...(input.cursor && { after: input.cursor }),
        },
        retries: 3,
      });

      const data = response.data;
      const deals = data.results.map((deal: any) => ({
        id: deal.id,
        dealname: deal.properties?.['dealname'] ?? undefined,
        dealstage: deal.properties?.['dealstage'] ?? undefined,
        pipeline: deal.properties?.['pipeline'] ?? undefined,
        amount: deal.properties?.['amount'] ? parseFloat(deal.properties['amount']) : undefined,
        closedate: deal.properties?.['closedate'] ?? undefined,
        createdate: deal.properties?.['createdate'] ?? undefined,
        hs_lastmodifieddate: deal.properties?.['hs_lastmodifieddate'] ?? undefined,
      }));

      return {
        deals,
        nextCursor: data.paging?.next?.after || undefined,
      };
    },
  });
}
