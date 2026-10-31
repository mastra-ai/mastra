// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeCampaignInputSchema = z.object({
  resourceName: z.string().describe('Campaign resource name. Example: "customers/1781900691/campaigns/24036861751"'),
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
        resourceName: z.string(),
      }),
    )
    .optional(),
});

export const removeCampaignOutputSchema = z.object({
  resourceName: z.string(),
});

export function removeCampaignTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_campaign',
    description: 'Remove a campaign by resource name.',
    inputSchema: removeCampaignInputSchema,
    outputSchema: removeCampaignOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeCampaignOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const match = input.resourceName.match(/^customers\/(\d+)\/campaigns\/(\d+)$/);
      if (!match) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'resourceName must be in the format customers/{customerId}/campaigns/{campaignId}',
          resourceName: input.resourceName,
        });
      }

      const customerId = match[1];
      if (!customerId) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Could not extract customerId from resourceName',
          resourceName: input.resourceName,
        });
      }

      // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
      const response = await platformProxy.post({
        endpoint: `/v25/customers/${encodeURIComponent(customerId)}/campaigns:mutate`,
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

      if (!providerResponse.results || providerResponse.results.length === 0) {
        throw new platformProxy.ActionError({
          type: 'remove_failed',
          message: 'Campaign removal did not return a result',
          resourceName: input.resourceName,
        });
      }

      const firstResult = providerResponse.results[0];
      if (!firstResult) {
        throw new platformProxy.ActionError({
          type: 'remove_failed',
          message: 'Campaign removal did not return a result',
          resourceName: input.resourceName,
        });
      }

      return {
        resourceName: firstResult.resourceName,
      };
    },
  });
}
