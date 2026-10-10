// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const updateCampaignBudgetInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  campaignBudgetId: z.string().describe('Campaign budget ID to update. Example: "15717542877"'),
  amountMicros: z.string().optional().describe('Average daily budget amount in micros. Example: "500000"'),
  name: z.string().optional().describe('Name of the campaign budget.'),
  explicitlyShared: z.boolean().optional().describe('Whether this budget can be shared across campaigns.'),
  deliveryMethod: z.string().optional().describe('Delivery method. Example: "STANDARD" or "ACCELERATED"'),
  totalAmountMicros: z.string().optional().describe('Total budget amount in micros for custom period budgets.'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
});

export const updateCampaignBudgetOutputSchema = z.object({
  resourceName: z
    .string()
    .describe(
      'Resource name of the updated campaign budget. Example: "customers/1781900691/campaignBudgets/15717542877"',
    ),
});

const MutateResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string(),
      }),
    )
    .optional(),
});

export function updateCampaignBudgetTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_update_campaign_budget',
    description: 'Update mutable fields on a campaign budget.',
    inputSchema: updateCampaignBudgetInputSchema,
    outputSchema: updateCampaignBudgetOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateCampaignBudgetOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      if (input.amountMicros !== undefined && input.totalAmountMicros !== undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'amountMicros and totalAmountMicros are mutually exclusive; only one may be set.',
        });
      }

      if (input.explicitlyShared === true && input.name === undefined) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message:
            'name is required when setting explicitlyShared to true (a non-shared budget can only become shared together with a name change).',
        });
      }

      const resourceName = `customers/${input.customerId}/campaignBudgets/${input.campaignBudgetId}`;
      const updateFields: Record<string, unknown> = {
        resourceName,
      };
      const updateMaskParts: string[] = [];

      if (input.amountMicros !== undefined) {
        updateFields['amountMicros'] = input.amountMicros;
        updateMaskParts.push('amountMicros');
      }
      if (input.name !== undefined) {
        updateFields['name'] = input.name;
        updateMaskParts.push('name');
      }
      if (input.explicitlyShared !== undefined) {
        updateFields['explicitlyShared'] = input.explicitlyShared;
        updateMaskParts.push('explicitlyShared');
      }
      if (input.deliveryMethod !== undefined) {
        updateFields['deliveryMethod'] = input.deliveryMethod;
        updateMaskParts.push('deliveryMethod');
      }
      if (input.totalAmountMicros !== undefined) {
        updateFields['totalAmountMicros'] = input.totalAmountMicros;
        updateMaskParts.push('totalAmountMicros');
      }

      if (updateMaskParts.length === 0) {
        throw new platformProxy.ActionError({
          type: 'missing_fields',
          message: 'At least one field to update must be provided.',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/reference/rest/v25/customers.campaignBudgets/mutate
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/campaignBudgets:mutate`,
        data: {
          operations: [
            {
              update: updateFields,
              updateMask: updateMaskParts.join(','),
            },
          ],
        },
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        retries: 1,
      });

      const responseData = MutateResponseSchema.parse(response.data);

      if (!responseData.results || responseData.results.length === 0) {
        throw new platformProxy.ActionError({
          type: 'no_results',
          message: 'The mutate request did not return any results.',
        });
      }

      const firstResult = responseData.results[0];

      if (!firstResult) {
        throw new platformProxy.ActionError({
          type: 'no_results',
          message: 'The mutate request did not return any results.',
        });
      }

      return {
        resourceName: firstResult.resourceName,
      };
    },
  });
}
