// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const listAccessibleCustomersInputSchema = z.object({});

const ProviderResponseSchema = z.object({
  resourceNames: z.array(z.string()).optional(),
});

export const listAccessibleCustomersOutputSchema = z.object({
  resourceNames: z.array(z.string()).optional(),
});

export function listAccessibleCustomersTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_list_accessible_customers',
    description: 'List customer accounts directly accessible to the authenticated user.',
    inputSchema: listAccessibleCustomersInputSchema,
    outputSchema: listAccessibleCustomersOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAccessibleCustomersOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const response = await platformProxy.get({
        // https://developers.google.com/google-ads/api/docs/account-management/listing-accounts
        endpoint: 'v25/customers:listAccessibleCustomers',
        headers: {
          'developer-token': developerToken,
        },
        retries: 3,
      });

      const providerData = ProviderResponseSchema.parse(response.data);

      return {
        ...(providerData.resourceNames !== undefined && { resourceNames: providerData.resourceNames }),
      };
    },
  });
}
