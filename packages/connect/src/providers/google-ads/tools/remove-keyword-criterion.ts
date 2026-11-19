// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeKeywordCriterionInputSchema = z.object({
  resource_name: z
    .string()
    .describe(
      'Ad group criterion resource name. Example: customers/1781900691/adGroupCriteria/197714341345~2491223357239',
    ),
  login_customer_id: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: 3608201627',
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

export const removeKeywordCriterionOutputSchema = z.object({
  resource_name: z.string().optional(),
  success: z.boolean(),
});

export function removeKeywordCriterionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_keyword_criterion',
    description: 'Remove a keyword criterion from an ad group.',
    inputSchema: removeKeywordCriterionInputSchema,
    outputSchema: removeKeywordCriterionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeKeywordCriterionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const match = input.resource_name.match(/^customers\/(\d+)\/adGroupCriteria\/(.+)$/);
      if (!match) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message:
            'Invalid ad group criterion resource name format. Expected: customers/{customerId}/adGroupCriteria/{adGroupId}~{criterionId}',
        });
      }

      const customerId = match[1];
      if (!customerId) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message:
            'Invalid ad group criterion resource name format. Expected: customers/{customerId}/adGroupCriteria/{adGroupId}~{criterionId}',
        });
      }

      // https://developers.google.com/google-ads/api/reference/rpc/v25/AdGroupCriterionService/MutateAdGroupCriteria
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(customerId)}/adGroupCriteria:mutate`,
        headers: {
          'developer-token': developerToken,
          ...(input.login_customer_id && { 'login-customer-id': input.login_customer_id }),
        },
        data: {
          operations: [
            {
              remove: input.resource_name,
            },
          ],
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      return {
        ...(providerResponse.results && providerResponse.results[0] && providerResponse.results[0].resourceName != null
          ? { resource_name: providerResponse.results[0].resourceName }
          : {}),
        success: true,
      };
    },
  });
}
