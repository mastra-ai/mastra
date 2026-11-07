// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeCampaignBudgetInputSchema = z.object({
  resource_name: z.string().describe('The campaign budget resource name. Example: "customers/123/campaignBudgets/456"'),
  login_customer_id: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
});

export const removeCampaignBudgetOutputSchema = z.object({
  resource_name: z.string().optional(),
});

const ProviderMutateResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string().optional(),
      }),
    )
    .optional(),
});

const ProviderErrorBodySchema = z.object({
  error: z
    .object({
      details: z
        .array(
          z
            .object({
              errors: z
                .array(
                  z
                    .object({
                      message: z.string().optional(),
                      errorCode: z
                        .object({
                          campaignBudgetError: z.string().optional(),
                        })
                        .optional(),
                    })
                    .optional(),
                )
                .optional(),
            })
            .passthrough(),
        )
        .optional(),
    })
    .optional(),
});

export function removeCampaignBudgetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_campaign_budget',
    description: 'Remove an unused campaign budget by resource name.',
    inputSchema: removeCampaignBudgetInputSchema,
    outputSchema: removeCampaignBudgetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeCampaignBudgetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const parts = input.resource_name.split('/');
      const customerId = parts[1];

      if (!customerId || parts.length < 4 || parts[0] !== 'customers' || parts[2] !== 'campaignBudgets' || !parts[3]) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Invalid resource_name format. Expected "customers/{customerId}/campaignBudgets/{budgetId}"',
        });
      }

      // @allowTryCatch Intercept provider HTTP errors to surface CAMPAIGN_BUDGET_IN_USE as a typed ActionError.
      try {
        const response = await platformProxy.post({
          // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
          endpoint: `v25/customers/${encodeURIComponent(customerId)}/campaignBudgets:mutate`,
          data: {
            operations: [
              {
                remove: input.resource_name,
              },
            ],
          },
          retries: 10,
          headers: {
            'developer-token': developerToken,
            ...(input.login_customer_id && { 'login-customer-id': input.login_customer_id }),
          },
        });

        const providerResponse = ProviderMutateResponseSchema.parse(response.data);
        return {
          resource_name: providerResponse.results?.[0]?.resourceName,
        };
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof error.response === 'object' &&
          error.response !== null &&
          'data' in error.response
        ) {
          const errorData = ProviderErrorBodySchema.safeParse(error.response.data);

          if (errorData.success) {
            const firstError = errorData.data.error?.details?.[0]?.errors?.[0];
            if (firstError?.errorCode?.campaignBudgetError === 'CAMPAIGN_BUDGET_IN_USE') {
              throw new platformProxy.ActionError({
                type: 'campaign_budget_in_use',
                message: 'The campaign budget is still attached to a campaign and cannot be removed.',
              });
            }
            if (firstError?.message) {
              throw new platformProxy.ActionError({
                type: 'google_ads_error',
                message: firstError.message,
              });
            }
          }
        }
        throw error;
      }
    },
  });
}
