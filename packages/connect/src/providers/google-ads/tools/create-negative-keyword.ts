// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createNegativeKeywordInputSchema = z.object({
  customer_id: z.string().describe('Customer ID. Example: "1781900691"'),
  login_customer_id: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
  ad_group_id: z.string().describe('Ad group ID. Example: "197714341345"'),
  text: z.string().describe('Keyword text. Example: "free"'),
  match_type: z.enum(['EXACT', 'PHRASE', 'BROAD']).describe('Keyword match type. Example: "EXACT"'),
});

const ProviderResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string(),
      }),
    )
    .optional(),
});

export const createNegativeKeywordOutputSchema = z.object({
  resource_name: z.string(),
});

export function createNegativeKeywordTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_negative_keyword',
    description: 'Add a negative keyword criterion to an ad group so its ads stop showing for that term.',
    inputSchema: createNegativeKeywordInputSchema,
    outputSchema: createNegativeKeywordOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createNegativeKeywordOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const customerId = encodeURIComponent(input.customer_id);
      const adGroup = `customers/${input.customer_id}/adGroups/${input.ad_group_id}`;

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
        endpoint: `v25/customers/${customerId}/adGroupCriteria:mutate`,
        headers: {
          'developer-token': developerToken,
          ...(input.login_customer_id && { 'login-customer-id': input.login_customer_id }),
        },
        data: {
          operations: [
            {
              create: {
                adGroup,
                keyword: {
                  text: input.text,
                  matchType: input.match_type,
                },
                negative: true,
              },
            },
          ],
        },
        retries: 10,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const result = providerResponse.results?.[0];
      if (!result) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'Mutation succeeded but returned no results.',
        });
      }

      return {
        resource_name: result.resourceName,
      };
    },
  });
}
