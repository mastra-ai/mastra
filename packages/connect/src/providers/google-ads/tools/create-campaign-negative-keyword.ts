// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createCampaignNegativeKeywordInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  campaignId: z.string().describe('Campaign ID. Example: "24027360183"'),
  text: z.string().describe('Negative keyword text. Example: "free"'),
  matchType: z.enum(['EXACT', 'PHRASE', 'BROAD']).describe('Keyword match type.'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
});

const ProviderResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string().optional(),
      }),
    )
    .optional(),
});

export const createCampaignNegativeKeywordOutputSchema = z.object({
  resourceName: z
    .string()
    .describe(
      'Resource name of the created campaign criterion. Example: "customers/1781900691/campaignCriteria/24027360183~123456789"',
    ),
});

export function createCampaignNegativeKeywordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_campaign_negative_keyword',
    description: 'Add a negative keyword criterion at the campaign level.',
    inputSchema: createCampaignNegativeKeywordInputSchema,
    outputSchema: createCampaignNegativeKeywordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCampaignNegativeKeywordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const campaignResourceName = `customers/${input.customerId}/campaigns/${input.campaignId}`;

      // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/campaignCriteria:mutate`,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        data: {
          operations: [
            {
              create: {
                campaign: campaignResourceName,
                keyword: {
                  text: input.text,
                  matchType: input.matchType,
                },
                negative: true,
              },
            },
          ],
        },
        retries: 10,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'No data returned from Google Ads API.',
        });
      }

      const parsed = ProviderResponseSchema.parse(response.data);
      const result = parsed.results?.[0];

      if (!result || !result.resourceName) {
        throw new platformProxy.ActionError({
          type: 'api_error',
          message: 'Failed to create campaign negative keyword. No resource name returned.',
        });
      }

      return {
        resourceName: result.resourceName,
      };
    },
  });
}
