// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const searchGoogleAdsInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  query: z.string().describe('GAQL query string. Example: "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"'),
  pageToken: z.string().optional().describe('Pagination token from the previous response. Omit for the first page.'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through a manager hierarchy. Example: "3608201627"',
    ),
});

const SearchResponseSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
  nextPageToken: z.string().optional(),
  fieldMask: z.string().optional(),
});

export const searchGoogleAdsOutputSchema = z.object({
  results: z.array(z.record(z.string(), z.unknown())).optional(),
  nextPageToken: z.string().optional(),
});

export function searchGoogleAdsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_search_google_ads',
    description: 'Run a GAQL query and return paged Google Ads rows.',
    inputSchema: searchGoogleAdsInputSchema,
    outputSchema: searchGoogleAdsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchGoogleAdsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      // https://developers.google.com/google-ads/api/docs/reporting/streaming
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/googleAds:search`,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        data: {
          query: input.query,
          ...(input.pageToken !== undefined && { pageToken: input.pageToken }),
        },
        retries: 3,
      });

      const searchResponse = SearchResponseSchema.parse(response.data);

      return {
        ...(searchResponse.results !== undefined && { results: searchResponse.results }),
        ...(searchResponse.nextPageToken !== undefined && { nextPageToken: searchResponse.nextPageToken }),
      };
    },
  });
}
