// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeConversionActionInputSchema = z.object({
  resourceName: z
    .string()
    .describe('Resource name of the conversion action to remove. Example: customers/123/conversionActions/456'),
  loginCustomerId: z
    .string()
    .regex(/^\d+$/, 'loginCustomerId must contain only digits')
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
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

export const removeConversionActionOutputSchema = z.object({
  resourceName: z.string().optional(),
});

export function removeConversionActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_conversion_action',
    description: 'Remove a conversion action by resource name.',
    inputSchema: removeConversionActionInputSchema,
    outputSchema: removeConversionActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeConversionActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const match = input.resourceName.match(/^customers\/(\d+)\/conversionActions\/(\d+)$/);
      if (!match) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'resourceName must be in the format customers/{customerId}/conversionActions/{conversionActionId}',
        });
      }
      const customerId = match[1];
      if (!customerId) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Could not extract customerId from resourceName',
        });
      }

      const config: PlatformProxyRequest = {
        // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
        endpoint: `v25/customers/${encodeURIComponent(customerId)}/conversionActions:mutate`,
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
      };

      const response = await platformProxy.post(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Empty response from Google Ads API',
        });
      }

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const result = providerResponse.results?.[0];

      return {
        ...(result?.resourceName != null && { resourceName: result.resourceName }),
      };
    },
  });
}
