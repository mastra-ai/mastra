// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeCampaignCriterionInputSchema = z.object({
  customerId: z.string().describe('The Google Ads customer ID. Example: "1781900691"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
  resourceName: z
    .string()
    .describe(
      'The resource name of the campaign criterion to remove. Example: "customers/1781900691/campaignCriteria/24027360183~2515302470834"',
    ),
});

const ProviderResultSchema = z.object({
  resourceName: z.string(),
});

const ProviderResponseSchema = z.object({
  results: z.array(ProviderResultSchema).optional(),
  partialFailureError: z
    .object({
      code: z.number(),
      message: z.string(),
      details: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export const removeCampaignCriterionOutputSchema = z.object({
  resourceName: z.string().describe('The resource name of the removed campaign criterion.'),
});

export function removeCampaignCriterionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_campaign_criterion',
    description: 'Remove a campaign-level criterion (negative keyword or location target) by resource name.',
    inputSchema: removeCampaignCriterionInputSchema,
    outputSchema: removeCampaignCriterionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeCampaignCriterionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/campaignCriteria:mutate`,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        data: {
          operations: [
            {
              remove: input.resourceName,
            },
          ],
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      if (providerResponse.partialFailureError) {
        throw new platformProxy.ActionError({
          type: 'partial_failure',
          message: providerResponse.partialFailureError.message,
          customerId: input.customerId,
          resourceName: input.resourceName,
        });
      }

      const results = providerResponse.results;
      if (!results || results.length === 0) {
        throw new platformProxy.ActionError({
          type: 'remove_failed',
          message: 'Campaign criterion removal did not return a result.',
          customerId: input.customerId,
          resourceName: input.resourceName,
        });
      }

      const firstResult = results[0];
      if (!firstResult) {
        throw new platformProxy.ActionError({
          type: 'remove_failed',
          message: 'Campaign criterion removal did not return a result.',
          customerId: input.customerId,
          resourceName: input.resourceName,
        });
      }

      return {
        resourceName: firstResult.resourceName,
      };
    },
  });
}
