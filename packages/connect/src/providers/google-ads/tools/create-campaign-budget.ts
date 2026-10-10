// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createCampaignBudgetInputSchema = z.object({
  customerId: z.string().describe('The Google Ads customer ID. Example: "1781900691"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
  name: z.string().describe('The name of the campaign budget.'),
  amountMicros: z.string().describe('The budget amount in micros. Example: "1000000"'),
  deliveryMethod: z.enum(['STANDARD', 'ACCELERATED']).describe('The delivery method for the budget.'),
  explicitlyShared: z.boolean().describe('Whether the budget is shared across multiple campaigns.'),
});

export const createCampaignBudgetOutputSchema = z.object({
  resourceName: z.string(),
  id: z.string().optional(),
});

const MutateResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string(),
      }),
    )
    .optional(),
  partialFailureError: z.unknown().optional(),
});

const PartialFailureErrorSchema = z.object({
  message: z.string().optional(),
});

export function createCampaignBudgetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_campaign_budget',
    description: 'Create a campaign budget for one or more campaigns.',
    inputSchema: createCampaignBudgetInputSchema,
    outputSchema: createCampaignBudgetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCampaignBudgetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const config: PlatformProxyRequest = {
        // https://developers.google.com/google-ads/api/reference/rpc/v25/CampaignBudgetService/MutateCampaignBudgets
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/campaignBudgets:mutate`,
        data: {
          operations: [
            {
              create: {
                name: input.name,
                amountMicros: input.amountMicros,
                deliveryMethod: input.deliveryMethod,
                explicitlyShared: input.explicitlyShared,
              },
            },
          ],
        },
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);

      const parsed = MutateResponseSchema.parse(response.data);

      if (parsed.partialFailureError) {
        const errorParse = PartialFailureErrorSchema.safeParse(parsed.partialFailureError);
        throw new platformProxy.ActionError({
          type: 'partial_failure',
          message:
            errorParse.success && errorParse.data.message
              ? errorParse.data.message
              : 'Partial failure occurred during budget creation.',
          details: parsed.partialFailureError,
        });
      }

      const result = parsed.results?.[0];
      if (!result) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'No result returned from campaign budget creation.',
        });
      }

      return {
        resourceName: result.resourceName,
        id: result.resourceName.split('/').pop(),
      };
    },
  });
}
