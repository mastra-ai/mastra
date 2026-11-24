// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getMetadataInputSchema = z.object({
  propertyId: z.string().describe('GA4 property ID. Use "0" for universal metadata. Example: "123456789"'),
});

const DimensionSchema = z.object({
  apiName: z.string(),
  uiName: z.string(),
  description: z.string(),
  category: z.string(),
  deprecatedApiNames: z.array(z.string()).optional(),
});

const MetricSchema = z.object({
  apiName: z.string(),
  uiName: z.string(),
  description: z.string(),
  type: z.string(),
  category: z.string(),
  deprecatedApiNames: z.array(z.string()).optional(),
});

export const getMetadataOutputSchema = z.object({
  name: z.string(),
  dimensions: z.array(DimensionSchema),
  metrics: z.array(MetricSchema),
});

export function getMetadataTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_get_metadata',
    description: 'Retrieve GA4 dimensions and metrics metadata.',
    inputSchema: getMetadataInputSchema,
    outputSchema: getMetadataOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getMetadataOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const config: PlatformProxyRequest = {
        // https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/getMetadata
        endpoint: `/v1beta/properties/${encodeURIComponent(input.propertyId)}/metadata`,
        retries: 3,
        baseUrlOverride: 'https://analyticsdata.googleapis.com',
      };

      const response = await platformProxy.get(config);

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Metadata not found for the specified property.',
        });
      }

      const providerResponse = getMetadataOutputSchema.parse(response.data);
      return providerResponse;
    },
  });
}
