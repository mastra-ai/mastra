// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const removeAdGroupInputSchema = z.object({
  resourceName: z.string().describe('Ad group resource name. Example: "customers/1781900691/adGroups/197714341425"'),
  loginCustomerId: z
    .string()
    .regex(/^\d+$/, 'loginCustomerId must contain only digits')
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
});

const ProviderMutateResponseSchema = z.object({
  results: z
    .array(
      z.object({
        resourceName: z.string(),
      }),
    )
    .optional(),
});

export const removeAdGroupOutputSchema = z.object({
  resourceName: z.string(),
});

export function removeAdGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_remove_ad_group',
    description: 'Remove an ad group by resource name.',
    inputSchema: removeAdGroupInputSchema,
    outputSchema: removeAdGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof removeAdGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const resourceName = input.resourceName;
      const match = resourceName.match(/^customers\/([^/]+)\/adGroups\/([^/]+)$/);

      if (!match) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Invalid ad group resource name format. Expected: customers/{customerId}/adGroups/{adGroupId}',
        });
      }

      const customerId = match[1];

      if (!customerId) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'Could not extract customer ID from resource name.',
        });
      }

      // https://developers.google.com/google-ads/api/docs/mutating/service-mutates
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(customerId)}/adGroups:mutate`,
        data: {
          operations: [
            {
              remove: resourceName,
            },
          ],
        },
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        retries: 1,
      });

      const parsed = ProviderMutateResponseSchema.parse(response.data);
      const resultResourceName = parsed.results?.[0]?.resourceName;

      if (!resultResourceName) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Provider did not return a resource name for the removed ad group.',
        });
      }

      return {
        resourceName: resultResourceName,
      };
    },
  });
}
