// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createKeywordCriterionInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  adGroupId: z.string().describe('Ad group ID to add the keyword to. Example: "197714341345"'),
  keywordText: z.string().describe('Keyword text. Example: "nango integration"'),
  keywordMatchType: z.enum(['EXACT', 'PHRASE', 'BROAD']).describe('Keyword match type. Example: "EXACT"'),
  status: z.enum(['ENABLED', 'PAUSED']).describe('Criterion status. Example: "ENABLED"'),
  cpcBidMicros: z.number().optional().describe('Optional CPC bid in micros. Example: 1000000'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
});

const ProviderResultSchema = z.object({
  resourceName: z.string(),
});

const ProviderResponseSchema = z.object({
  results: z.array(ProviderResultSchema).optional(),
});

export const createKeywordCriterionOutputSchema = z.object({
  resourceName: z.string().describe('Full resource name of the created criterion.'),
  criterionId: z.string().optional().describe('Numeric criterion ID extracted from the resource name.'),
});

export function createKeywordCriterionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_keyword_criterion',
    description: 'Add a positive keyword criterion to an ad group.',
    inputSchema: createKeywordCriterionInputSchema,
    outputSchema: createKeywordCriterionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createKeywordCriterionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const mutateBody: {
        operations: Array<{
          create: {
            adGroup: string;
            status: string;
            keyword: {
              text: string;
              matchType: string;
            };
            cpcBidMicros?: number;
          };
        }>;
      } = {
        operations: [
          {
            create: {
              adGroup: `customers/${input.customerId}/adGroups/${input.adGroupId}`,
              status: input.status,
              keyword: {
                text: input.keywordText,
                matchType: input.keywordMatchType,
              },
              ...(input.cpcBidMicros !== undefined && { cpcBidMicros: input.cpcBidMicros }),
            },
          },
        ],
      };

      // https://developers.google.com/google-ads/api/reference/rpc/v25/AdGroupCriterionService/MutateAdGroupCriteria
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/adGroupCriteria:mutate`,
        data: mutateBody,
        retries: 1,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
      });

      const parsed = ProviderResponseSchema.parse(response.data);
      const result = parsed.results?.[0];

      if (!result) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'Mutate response did not contain a result.',
          response: response.data,
        });
      }

      const resourceName = result.resourceName;
      const match = resourceName.match(/~(\d+)$/);
      const criterionId = match ? match[1] : undefined;

      return {
        resourceName,
        ...(criterionId !== undefined && { criterionId }),
      };
    },
  });
}
