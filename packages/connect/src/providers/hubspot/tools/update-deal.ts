// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateDealInputSchema = z.object({
  dealId: z.string().describe('The ID of the deal to update. Example: "12345"'),
  dealname: z.string().optional().describe('The name of the deal. Example: "Acme Corp Annual Deal"'),
  amount: z.number().optional().describe('The deal amount in the currency. Example: 50000'),
  closedate: z.string().optional().describe('The expected close date (ISO 8601 format). Example: "2026-06-30"'),
  dealstage: z.string().optional().describe('The stage of the deal (internal stage ID). Example: "qualifiedtobuy"'),
  pipeline: z.string().optional().describe('The pipeline ID for the deal. Example: "default"'),
});

export const updateDealOutputSchema = z.object({
  id: z.string(),
  dealname: z.string().optional(),
  amount: z.number().optional(),
  closedate: z.string().optional(),
  dealstage: z.string().optional(),
  pipeline: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export function updateDealTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_update_deal',
    description: 'Update a deal record in HubSpot CRM',
    inputSchema: updateDealInputSchema,
    outputSchema: updateDealOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateDealOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api/crm/deals
      const properties: Record<string, string | number> = {};

      // Presence check, not truthiness: HubSpot clears a property when sent '',
      // so an explicitly-supplied empty string must reach the request body.
      if (input.dealname !== undefined) properties['dealname'] = input.dealname;
      if (input.amount !== undefined) properties['amount'] = input.amount;
      if (input.closedate !== undefined) properties['closedate'] = input.closedate;
      if (input.dealstage !== undefined) properties['dealstage'] = input.dealstage;
      if (input.pipeline !== undefined) properties['pipeline'] = input.pipeline;

      const response = await platformProxy.patch({
        endpoint: `/crm/v3/objects/deals/${input.dealId}`,
        data: { properties },
        retries: 3,
      });

      const data = response.data;

      return {
        id: data.id,
        dealname: data.properties?.['dealname'] ?? undefined,
        amount: data.properties?.['amount'] ? Number(data.properties['amount']) : undefined,
        closedate: data.properties?.['closedate'] ?? undefined,
        dealstage: data.properties?.['dealstage'] ?? undefined,
        pipeline: data.properties?.['pipeline'] ?? undefined,
        createdAt: data.createdAt ?? undefined,
        updatedAt: data.updatedAt ?? undefined,
      };
    },
  });
}
