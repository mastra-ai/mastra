// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

const MetadataSchema = z.object({
  loginCustomerId: z.string().optional(),
});

export const updateConversionActionInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  conversionActionId: z.string().describe('Conversion action ID. Example: "7685274465"'),
  name: z.string().optional().describe('New name for the conversion action'),
  status: z.enum(['ENABLED', 'PAUSED', 'REMOVED']).optional().describe('Status of the conversion action'),
  valueSettings: z
    .object({
      defaultValue: z.number().optional().describe('Default value for the conversion action'),
      defaultCurrencyCode: z.string().optional().describe('Default currency code'),
      alwaysUseDefaultValue: z.boolean().optional().describe('Whether to always use the default value'),
    })
    .optional()
    .describe('Value settings for the conversion action'),
  loginCustomerId: z.string().optional().describe('Manager account ID for access. Example: "3608201627"'),
});

const ProviderResponseSchema = z.object({
  results: z.array(
    z.object({
      resourceName: z.string(),
    }),
  ),
});

export const updateConversionActionOutputSchema = z.object({
  resourceName: z.string().describe('Resource name of the updated conversion action'),
});

export function updateConversionActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_update_conversion_action',
    description: 'Update mutable fields on a conversion action',
    inputSchema: updateConversionActionInputSchema,
    outputSchema: updateConversionActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateConversionActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      let loginCustomerId = input.loginCustomerId;

      if (!loginCustomerId) {
        const rawMetadata = await platformProxy.getMetadata();
        const metadata = MetadataSchema.parse(rawMetadata ?? {});
        loginCustomerId = loginCustomerId ?? metadata.loginCustomerId;
      }

      const developerToken = await getDeveloperToken(platformProxy);

      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const updateMaskFields: string[] = [];
      const updatePayload: Record<string, unknown> = {
        resourceName: `customers/${input.customerId}/conversionActions/${input.conversionActionId}`,
      };

      if (input.name !== undefined) {
        updateMaskFields.push('name');
        updatePayload['name'] = input.name;
      }

      if (input.status !== undefined) {
        updateMaskFields.push('status');
        updatePayload['status'] = input.status;
      }

      if (input.valueSettings !== undefined) {
        const valueSettingsPayload: Record<string, unknown> = {};

        if (input.valueSettings.defaultValue !== undefined) {
          updateMaskFields.push('valueSettings.defaultValue');
          valueSettingsPayload['defaultValue'] = input.valueSettings.defaultValue;
        }

        if (input.valueSettings.defaultCurrencyCode !== undefined) {
          updateMaskFields.push('valueSettings.defaultCurrencyCode');
          valueSettingsPayload['defaultCurrencyCode'] = input.valueSettings.defaultCurrencyCode;
        }

        if (input.valueSettings.alwaysUseDefaultValue !== undefined) {
          updateMaskFields.push('valueSettings.alwaysUseDefaultValue');
          valueSettingsPayload['alwaysUseDefaultValue'] = input.valueSettings.alwaysUseDefaultValue;
        }

        if (Object.keys(valueSettingsPayload).length > 0) {
          updatePayload['valueSettings'] = valueSettingsPayload;
        }
      }

      if (updateMaskFields.length === 0) {
        throw new platformProxy.ActionError({
          type: 'empty_update',
          message: 'At least one field must be provided to update.',
        });
      }

      const headers: Record<string, string> = {
        'developer-token': developerToken,
      };

      if (loginCustomerId) {
        headers['login-customer-id'] = loginCustomerId;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/reference/rpc/v25/ConversionActionService/MutateConversionActions
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/conversionActions:mutate`,
        data: {
          operations: [
            {
              updateMask: updateMaskFields.join(','),
              update: updatePayload,
            },
          ],
        },
        headers,
        retries: 10,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      if (!providerResponse.results[0]) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'No result returned from the API.',
        });
      }

      return {
        resourceName: providerResponse.results[0].resourceName,
      };
    },
  });
}
