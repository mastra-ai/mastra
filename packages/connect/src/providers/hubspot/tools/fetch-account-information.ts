// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const fetchAccountInformationInputSchema = z.object({});

export const fetchAccountInformationOutputSchema = z.object({
  portalId: z.number(),
  accountType: z.string().optional(),
  timezone: z.string().optional(),
  companyCurrency: z.string().optional(),
  additionalCurrencies: z.array(z.string()),
  dataHostingLocation: z.string().optional(),
  uiDomain: z.string().optional(),
  utcOffset: z.string().optional(),
  utcOffsetMilliseconds: z.number().optional(),
});

export function fetchAccountInformationTool(proxy: PlatformProxy) {
  return createTool({
    id: 'hubspot_fetch_account_information',
    description: 'Retrieve portal account details, currency settings, timezone, and hosting region',
    inputSchema: fetchAccountInformationInputSchema,
    outputSchema: fetchAccountInformationOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof fetchAccountInformationOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.hubspot.com/docs/api-reference/account-account-info-v3/details/get-account-info-v3-details
      const response = await platformProxy.get({
        endpoint: '/account-info/v3/details',
        retries: 3,
      });

      const data = response.data;

      return {
        portalId: data.portalId,
        accountType: data.accountType ?? undefined,
        timezone: data.timeZone ?? undefined,
        companyCurrency: data.companyCurrency ?? undefined,
        additionalCurrencies: data.additionalCurrencies ?? [],
        dataHostingLocation: data.dataHostingLocation ?? undefined,
        uiDomain: data.uiDomain ?? undefined,
        utcOffset: data.utcOffset ?? undefined,
        utcOffsetMilliseconds: data.utcOffsetMilliseconds ?? undefined,
      };
    },
  });
}
