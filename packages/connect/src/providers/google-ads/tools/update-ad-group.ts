// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const updateAdGroupInputSchema = z.object({
  customerId: z.string().describe('The customer ID. Example: "1781900691"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe('The manager account ID (login-customer-id) if accessing via MCC. Example: "3608201627"'),
  adGroupId: z.string().describe('The ad group ID. Example: "197714341345"'),
  name: z.string().optional().describe('The new name for the ad group.'),
  status: z.enum(['UNSPECIFIED', 'UNKNOWN', 'ENABLED', 'PAUSED', 'REMOVED']).optional().describe('The new status.'),
  cpcBidMicros: z.string().optional().describe('The max CPC bid in micros as a string. Example: "1000000"'),
  targetingSetting: z
    .object({
      targetRestrictions: z
        .array(
          z.object({
            targetingDimension: z.string().optional(),
            bidOnly: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .optional()
    .describe('Targeting settings to update.'),
});

const ProviderResponseSchema = z.object({
  results: z.array(
    z.object({
      resourceName: z.string(),
    }),
  ),
});

export const updateAdGroupOutputSchema = z.object({
  resourceName: z.string(),
});

export function updateAdGroupTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_update_ad_group',
    description: 'Update mutable fields on an ad group.',
    inputSchema: updateAdGroupInputSchema,
    outputSchema: updateAdGroupOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAdGroupOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const resourceName = `customers/${input.customerId}/adGroups/${input.adGroupId}`;

      const updateBody: Record<string, unknown> = {
        resourceName,
      };

      const updateMaskParts: string[] = [];

      if (input.name !== undefined) {
        updateBody['name'] = input.name;
        updateMaskParts.push('name');
      }

      if (input.status !== undefined) {
        updateBody['status'] = input.status;
        updateMaskParts.push('status');
      }

      if (input.cpcBidMicros !== undefined) {
        updateBody['cpcBidMicros'] = input.cpcBidMicros;
        updateMaskParts.push('cpcBidMicros');
      }

      if (input.targetingSetting !== undefined) {
        updateBody['targetingSetting'] = input.targetingSetting;
        updateMaskParts.push('targetingSetting');
      }

      if (updateMaskParts.length === 0) {
        throw new platformProxy.ActionError({
          type: 'missing_fields',
          message: 'At least one field to update must be provided.',
        });
      }

      const headers: Record<string, string> = {
        'developer-token': developerToken,
      };

      if (input.loginCustomerId) {
        headers['login-customer-id'] = input.loginCustomerId;
      }

      // https://developers.google.com/google-ads/api/reference/rpc/v25/AdGroupService/MutateAdGroups
      const response = await platformProxy.post({
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/adGroups:mutate`,
        data: {
          operations: [
            {
              update: updateBody,
              updateMask: updateMaskParts.join(','),
            },
          ],
        },
        headers,
        retries: 1,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);
      const firstResult = providerResponse.results[0];

      if (!firstResult) {
        throw new platformProxy.ActionError({
          type: 'no_result',
          message: 'The API did not return a result for the update operation.',
        });
      }

      return {
        resourceName: firstResult.resourceName,
      };
    },
  });
}
