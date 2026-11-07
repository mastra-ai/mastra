// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const updateAdGroupAdInputSchema = z.object({
  customerId: z.string().describe('Customer ID. Example: "1781900691"'),
  resourceName: z
    .string()
    .describe('Ad group ad resource name. Example: "customers/1781900691/adGroupAds/197714341345~816946667438"'),
  updateMask: z.string().describe('Comma-separated list of fields to update. Example: "status" or "ad.finalUrls"'),
  status: z.string().optional().describe('Ad group ad status. Example: "ENABLED" or "PAUSED"'),
  finalUrls: z.array(z.string()).optional().describe('Final URLs for the ad'),
  labels: z.array(z.string()).optional().describe('Label resource names to attach to the ad group ad'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through an MCC hierarchy. Example: "3608201627"',
    ),
});

const MutateResultSchema = z.object({
  resourceName: z.string().optional(),
});

const MutateResponseSchema = z.object({
  results: z.array(MutateResultSchema).optional(),
});

export const updateAdGroupAdOutputSchema = z.object({
  resourceName: z.string().optional(),
});

export function updateAdGroupAdTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_update_ad_group_ad',
    description: 'Update mutable fields on an ad group ad',
    inputSchema: updateAdGroupAdInputSchema,
    outputSchema: updateAdGroupAdOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAdGroupAdOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const updateBody: Record<string, unknown> = {
        resourceName: input.resourceName,
      };

      if (input.status !== undefined) {
        updateBody['status'] = input.status;
      }

      if (input.finalUrls !== undefined) {
        updateBody['ad'] = {
          finalUrls: input.finalUrls,
        };
      }

      if (input.labels !== undefined) {
        updateBody['labels'] = input.labels;
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/reference/rpc/v25/AdGroupAdService/MutateAdGroupAds
        endpoint: `v25/customers/${encodeURIComponent(input.customerId)}/adGroupAds:mutate`,
        data: {
          operations: [
            {
              updateMask: input.updateMask,
              update: updateBody,
            },
          ],
        },
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
        retries: 3,
      });

      const parsed = MutateResponseSchema.parse(response.data);
      const firstResult = parsed.results?.[0];

      return {
        ...(firstResult?.resourceName != null && { resourceName: firstResult.resourceName }),
      };
    },
  });
}
