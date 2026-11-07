// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const updateKeywordCriterionInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
  resourceName: z
    .string()
    .describe(
      'Resource name of the ad group criterion. Example: "customers/1781900691/adGroupCriteria/197714341345~2491223357039"',
    ),
  status: z.enum(['ENABLED', 'PAUSED', 'REMOVED']).optional().describe('Keyword status to update.'),
  cpcBidMicros: z.string().optional().describe('CPC bid in micros to update. Example: "1500000"'),
  finalUrls: z.array(z.string()).optional().describe('Final URLs to update.'),
});

const ProviderMutateResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string(),
      }),
    )
    .optional(),
  partialFailureError: z.object({}).passthrough().optional(),
});

export const updateKeywordCriterionOutputSchema = z.object({
  resourceName: z.string(),
});

export function updateKeywordCriterionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_update_keyword_criterion',
    description: 'Update mutable fields on an ad group keyword criterion.',
    inputSchema: updateKeywordCriterionInputSchema,
    outputSchema: updateKeywordCriterionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateKeywordCriterionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const updateFields: Record<string, unknown> = {
        resourceName: input.resourceName,
      };
      const updateMaskFields: string[] = [];

      if (input.status !== undefined) {
        updateFields['status'] = input.status;
        updateMaskFields.push('status');
      }

      if (input.cpcBidMicros !== undefined) {
        updateFields['cpcBidMicros'] = input.cpcBidMicros;
        updateMaskFields.push('cpcBidMicros');
      }

      if (input.finalUrls !== undefined) {
        updateFields['finalUrls'] = input.finalUrls;
        updateMaskFields.push('finalUrls');
      }

      if (updateMaskFields.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one field to update must be provided (status, cpcBidMicros, or finalUrls).',
        });
      }

      // https://developers.google.com/google-ads/api/reference/rpc/v25/AdGroupCriterionService/MutateAdGroupCriteria
      const config: PlatformProxyRequest = {
        // https://developers.google.com/google-ads/api/reference/rpc/v25/AdGroupCriterionService/MutateAdGroupCriteria
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/adGroupCriteria:mutate`,
        data: {
          operations: [
            {
              update: updateFields,
              updateMask: updateMaskFields.join(','),
            },
          ],
        },
        retries: 0,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
      };
      const response = await platformProxy.post(config);

      const providerResponse = ProviderMutateResponseSchema.parse(response.data);

      if (providerResponse.partialFailureError) {
        throw new platformProxy.ActionError({
          type: 'partial_failure',
          message: 'The mutate operation partially failed.',
          details: providerResponse.partialFailureError,
        });
      }

      const firstResult = providerResponse.results?.[0];
      if (!firstResult) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'No result returned from the mutate operation.',
        });
      }

      return {
        resourceName: firstResult.resourceName,
      };
    },
  });
}
