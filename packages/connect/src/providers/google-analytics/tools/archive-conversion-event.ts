// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const archiveConversionEventInputSchema = z.object({
  property_id: z.string().describe('GA4 property numeric ID. Example: "12345"'),
  conversion_event_id: z.string().describe('Conversion event numeric ID. Example: "67890"'),
});

export const archiveConversionEventOutputSchema = z.object({
  success: z.boolean(),
  name: z.string().describe('Resource name of the archived conversion event.'),
});

export function archiveConversionEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_archive_conversion_event',
    description: 'Archive a GA4 conversion event.',
    inputSchema: archiveConversionEventInputSchema,
    outputSchema: archiveConversionEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof archiveConversionEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const name = `properties/${input.property_id}/conversionEvents/${input.conversion_event_id}`;

      await platformProxy.delete({
        // https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.conversionEvents/delete
        endpoint: `/v1beta/properties/${encodeURIComponent(input.property_id)}/conversionEvents/${encodeURIComponent(input.conversion_event_id)}`,
        baseUrlOverride: 'https://analyticsadmin.googleapis.com',
        retries: 3,
      });

      return {
        success: true,
        name,
      };
    },
  });
}
