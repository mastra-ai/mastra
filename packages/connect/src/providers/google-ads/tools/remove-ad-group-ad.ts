// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeAdGroupAdInputSchema = z.object({
  resource_name: z
    .string()
    .describe(
      'The resource name of the ad group ad to remove. Example: "customers/1781900691/adGroupAds/197714341345~816946667444"',
    ),
  login_customer_id: z
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
        resourceName: z.string(),
      }),
    )
    .optional(),
});

export const removeAdGroupAdOutputSchema = z.object({
  resource_name: z.string(),
});

export function removeAdGroupAdTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_ad_group_ad',
    description: 'Remove an ad from an ad group by resource name.',
    inputSchema: removeAdGroupAdInputSchema,
    outputSchema: removeAdGroupAdOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeAdGroupAdOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const resourceName = input.resource_name;
      const customerIdMatch = resourceName.match(/^customers\/(\d+)\/adGroupAds\//);
      if (!customerIdMatch) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Invalid resource_name format. Expected "customers/{customerId}/adGroupAds/{adGroupId}~{adId}".',
        });
      }
      const customerId = customerIdMatch[1];
      if (!customerId) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Could not extract customer ID from resource_name.',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
        endpoint: `v25/customers/${encodeURIComponent(customerId)}/adGroupAds:mutate`,
        data: {
          operations: [
            {
              remove: resourceName,
            },
          ],
        },
        headers: {
          'developer-token': developerToken,
          ...(input.login_customer_id && { 'login-customer-id': input.login_customer_id }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const result = providerResponse.results?.[0];
      if (!result) {
        throw new platformProxy.ActionError({
          type: 'remove_failed',
          message: 'Remove operation did not return a result.',
        });
      }

      return {
        resource_name: result.resourceName,
      };
    },
  });
}
