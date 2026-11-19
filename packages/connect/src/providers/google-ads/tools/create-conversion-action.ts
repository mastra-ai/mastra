// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const createConversionActionInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  loginCustomerId: z.string().optional().describe('Manager account ID for API access. Example: "3608201627"'),
  name: z.string().describe('Unique conversion action name.'),
  type: z.string().describe('Conversion action type. Example: "WEBPAGE"'),
  category: z.string().describe('Conversion action category. Example: "DEFAULT"'),
  status: z.string().describe('Conversion action status. Example: "ENABLED"'),
  defaultValue: z.number().optional().describe('Default conversion value.'),
});

export const createConversionActionOutputSchema = z.object({
  resourceName: z
    .string()
    .describe(
      'Resource name of the created conversion action. Example: "customers/1781900691/conversionActions/7685274465"',
    ),
});

const MutateResponseSchema = z.object({
  results: z.array(
    z.object({
      resourceName: z.string(),
    }),
  ),
});

export function createConversionActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_create_conversion_action',
    description: 'Create a conversion action for tracking conversions.',
    inputSchema: createConversionActionInputSchema,
    outputSchema: createConversionActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createConversionActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const headers: Record<string, string> = {
        'developer-token': developerToken,
      };

      if (input.loginCustomerId !== undefined && input.loginCustomerId !== '') {
        headers['login-customer-id'] = input.loginCustomerId;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/reference/rpc/v25/ConversionActionService/MutateConversionActions
        endpoint: `/v25/customers/${encodeURIComponent(input.customerId)}/conversionActions:mutate`,
        headers,
        data: {
          operations: [
            {
              create: {
                name: input.name,
                type: input.type,
                category: input.category,
                status: input.status,
                ...(input.defaultValue !== undefined && {
                  valueSettings: {
                    defaultValue: input.defaultValue,
                    alwaysUseDefaultValue: true,
                  },
                }),
              },
            },
          ],
        },
        retries: 10,
      });

      const parsed = MutateResponseSchema.parse(response.data);
      const result = parsed.results[0];

      if (!result) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'Conversion action was not created.',
        });
      }

      return {
        resourceName: result.resourceName,
      };
    },
  });
}
