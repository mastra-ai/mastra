// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createAdGroupInputSchema = z.object({
  campaign: z.string().describe('Campaign resource name. Example: "customers/123/campaigns/456"'),
  name: z.string().describe('Ad group name. Example: "My Ad Group"'),
  type: z.string().describe('Ad group type. Example: "SEARCH_STANDARD"'),
  status: z.string().describe('Ad group status. Example: "ENABLED" or "PAUSED"'),
  cpcBidMicros: z.string().describe('CPC bid in micros. Example: "1000000"'),
  loginCustomerId: z
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
        resourceName: z.string().optional().nullable(),
        adGroup: z
          .object({
            resourceName: z.string().optional(),
            id: z.string().optional(),
            name: z.string().optional(),
            status: z.string().optional(),
            type: z.string().optional(),
            campaign: z.string().optional(),
            cpcBidMicros: z.string().optional(),
          })
          .optional()
          .nullable(),
      }),
    )
    .optional(),
  partialFailureError: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      details: z.array(z.unknown()).optional(),
    })
    .optional()
    .nullable(),
});

export const createAdGroupOutputSchema = z.object({
  resourceName: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  campaign: z.string().optional(),
  cpcBidMicros: z.string().optional(),
});

export function createAdGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_ad_group',
    description: 'Create an ad group in an existing Google Ads campaign',
    inputSchema: createAdGroupInputSchema,
    outputSchema: createAdGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAdGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const campaignParts = input.campaign.split('/');
      const customerId = campaignParts[1];
      if (!customerId || campaignParts.length < 4) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Invalid campaign resource name format. Expected "customers/{customerId}/campaigns/{campaignId}".',
        });
      }

      const requestBody = {
        operations: [
          {
            create: {
              campaign: input.campaign,
              name: input.name,
              type: input.type,
              status: input.status,
              cpcBidMicros: input.cpcBidMicros,
            },
          },
        ],
        responseContentType: 'MUTABLE_RESOURCE',
      };

      // https://developers.google.com/google-ads/api/rest/reference/rest/v25/customers/adGroups/mutate
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(customerId)}/adGroups:mutate`,
        data: requestBody,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      if (providerResponse.partialFailureError) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: providerResponse.partialFailureError.message || 'Google Ads API returned a partial failure',
          details: providerResponse.partialFailureError.details,
        });
      }

      const result = providerResponse.results?.[0];
      if (!result || !result.resourceName) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'No result returned from ad group creation',
        });
      }

      const adGroup = result.adGroup;

      return {
        resourceName: result.resourceName,
        ...(adGroup?.id != null && { id: adGroup.id }),
        ...(adGroup?.name != null && { name: adGroup.name }),
        ...(adGroup?.status != null && { status: adGroup.status }),
        ...(adGroup?.type != null && { type: adGroup.type }),
        ...(adGroup?.campaign != null && { campaign: adGroup.campaign }),
        ...(adGroup?.cpcBidMicros != null && { cpcBidMicros: adGroup.cpcBidMicros }),
      };
    },
  });
}
