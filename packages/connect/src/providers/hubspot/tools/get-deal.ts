// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getDealInputSchema = z.object({
  dealId: z.string().describe('The ID of the deal to retrieve. Example: "12345678"'),
});

export const getDealOutputSchema = z.object({
  id: z.string(),
  dealName: z.string().optional(),
  dealStage: z.string().optional(),
  pipeline: z.string().optional(),
  amount: z.string().optional(),
  closeDate: z.string().optional(),
  createDate: z.string().optional(),
  hubspot_owner_id: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function getDealTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_get_deal',
    description: 'Get a deal by ID',
    inputSchema: getDealInputSchema,
    outputSchema: getDealOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getDealOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/deals
      const response = await platformProxy.get({
        endpoint: `/crm/v3/objects/deals/${input.dealId}`,
        params: {
          properties: 'dealname,dealstage,pipeline,amount,closedate,createdate,hubspot_owner_id,hs_lastmodifieddate',
        },
        retries: 3,
      });

      const data = response.data;

      if (!data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Deal not found',
          dealId: input.dealId,
        });
      }

      return {
        id: data.id,
        dealName: data.properties?.['dealname'] ?? undefined,
        dealStage: data.properties?.['dealstage'] ?? undefined,
        pipeline: data.properties?.['pipeline'] ?? undefined,
        amount: data.properties?.['amount'] ?? undefined,
        closeDate: data.properties?.['closedate'] ?? undefined,
        createDate: data.properties?.['createdate'] ?? undefined,
        hubspot_owner_id: data.properties?.['hubspot_owner_id'] ?? undefined,
        updatedAt: data.properties?.['hs_lastmodifieddate'] ?? undefined,
      };
    },
  });
}
