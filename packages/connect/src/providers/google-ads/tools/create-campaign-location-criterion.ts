// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createCampaignLocationCriterionInputSchema = z.object({
  customerId: z.string().describe('Customer ID. Example: "1781900691"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
  campaign: z.string().describe('Campaign resource name. Example: "customers/1781900691/campaigns/24027360183"'),
  geoTargetConstant: z.string().describe('Geo target constant resource name. Example: "geoTargetConstants/21167"'),
});

const ProviderResponseSchema = z.object({
  results: z.array(z.object({ resourceName: z.string() })).optional(),
  partialFailureError: z.object({ code: z.number(), message: z.string() }).optional(),
});

export const createCampaignLocationCriterionOutputSchema = z.object({
  resourceName: z.string(),
});

export function createCampaignLocationCriterionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_campaign_location_criterion',
    description: 'Add geographic location targeting to a campaign using a geo target constant.',
    inputSchema: createCampaignLocationCriterionInputSchema,
    outputSchema: createCampaignLocationCriterionOutputSchema,
    execute: async (
      input,
      { requestContext },
    ): Promise<z.infer<typeof createCampaignLocationCriterionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/rest/reference/rest/v25/customers/campaignCriteria/mutate
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/campaignCriteria:mutate`,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        data: {
          operations: [
            {
              create: {
                campaign: input.campaign,
                location: {
                  geoTargetConstant: input.geoTargetConstant,
                },
              },
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
          code: providerResponse.partialFailureError.code,
        });
      }

      const results = providerResponse.results;
      if (!results || results.length === 0) {
        throw new platformProxy.ActionError({
          type: 'no_results',
          message: 'The mutate operation did not return any results.',
        });
      }

      const firstResult = results[0];
      if (!firstResult) {
        throw new platformProxy.ActionError({
          type: 'no_results',
          message: 'The mutate operation did not return any results.',
        });
      }

      return {
        resourceName: firstResult.resourceName,
      };
    },
  });
}
