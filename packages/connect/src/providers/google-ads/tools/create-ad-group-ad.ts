// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

const MutateResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string(),
      }),
    )
    .optional(),
});

export const createAdGroupAdInputSchema = z.object({
  customerId: z.string().describe('The Google Ads customer ID. Example: "1781900691"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
  adGroupId: z.string().describe('The ad group ID where the ad will be created. Example: "197714341345"'),
  headlines: z.array(z.string()).min(3).describe('At least 3 headlines for the responsive search ad.'),
  descriptions: z.array(z.string()).min(2).describe('At least 2 descriptions for the responsive search ad.'),
  finalUrls: z.array(z.string()).min(1).describe('Final URLs for the ad.'),
  status: z.enum(['ENABLED', 'PAUSED']).optional().describe('Ad status. Defaults to ENABLED.'),
});

export const createAdGroupAdOutputSchema = z.object({
  resourceName: z.string(),
  adGroupAdId: z.string().optional(),
  adId: z.string().optional(),
});

export function createAdGroupAdTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_ad_group_ad',
    description: 'Create an ad inside an ad group.',
    inputSchema: createAdGroupAdInputSchema,
    outputSchema: createAdGroupAdOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAdGroupAdOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const status = input.status ?? 'ENABLED';

      const requestBody = {
        operations: [
          {
            create: {
              adGroup: `customers/${input.customerId}/adGroups/${input.adGroupId}`,
              status: status,
              ad: {
                finalUrls: input.finalUrls,
                responsiveSearchAd: {
                  headlines: input.headlines.map((text: string) => ({ text })),
                  descriptions: input.descriptions.map((text: string) => ({ text })),
                },
              },
            },
          },
        ],
      };

      // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/adGroupAds:mutate`,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        data: requestBody,
        retries: 10,
      });

      const parsed = MutateResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Unexpected response format from Google Ads API.',
          details: parsed.error.message,
        });
      }

      const results = parsed.data.results ?? [];
      const firstResult = results[0];
      if (firstResult == null) {
        throw new platformProxy.ActionError({
          type: 'no_results',
          message: 'Google Ads API returned no results for the mutate operation.',
        });
      }

      const resourceName = firstResult.resourceName;
      const match = resourceName.match(/^customers\/[^/]+\/adGroupAds\/[^~]+~([^/]+)$/);
      const adId = match != null && match[1] != null ? match[1] : undefined;

      return {
        resourceName: resourceName,
        adGroupAdId: adId ? `${input.adGroupId}~${adId}` : undefined,
        adId: adId,
      };
    },
  });
}
