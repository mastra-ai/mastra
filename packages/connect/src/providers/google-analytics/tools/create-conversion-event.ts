// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DefaultConversionValueInputSchema = z.object({
  value: z.number(),
  currencyCode: z.string(),
});

export const createConversionEventInputSchema = z.object({
  propertyId: z.string().describe('GA4 property ID. Example: "123456789"'),
  eventName: z.string().describe('The event name for this conversion event. Example: "click"'),
  countingMethod: z
    .string()
    .optional()
    .describe('Optional. The method by which conversions will be counted. Example: "ONCE_PER_EVENT"'),
  defaultConversionValue: DefaultConversionValueInputSchema.optional().describe(
    'Optional. Defines a default value/currency for a conversion event.',
  ),
});

const ProviderDefaultConversionValueSchema = z.object({
  value: z.number(),
  currencyCode: z.string(),
});

const ProviderConversionEventSchema = z.object({
  name: z.string(),
  eventName: z.string(),
  createTime: z.string().optional(),
  deletable: z.boolean().optional(),
  custom: z.boolean().optional(),
  countingMethod: z.string().optional(),
  defaultConversionValue: ProviderDefaultConversionValueSchema.optional(),
});

export const createConversionEventOutputSchema = z.object({
  name: z.string(),
  eventName: z.string(),
  createTime: z.string().optional(),
  deletable: z.boolean().optional(),
  custom: z.boolean().optional(),
  countingMethod: z.string().optional(),
  defaultConversionValue: z
    .object({
      value: z.number(),
      currencyCode: z.string(),
    })
    .optional(),
});

export function createConversionEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_create_conversion_event',
    description: 'Create a conversion event for a GA4 property.',
    inputSchema: createConversionEventInputSchema,
    outputSchema: createConversionEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createConversionEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.conversionEvents/create
        endpoint: `/v1beta/properties/${encodeURIComponent(input.propertyId)}/conversionEvents`,
        data: {
          eventName: input.eventName,
          ...(input.countingMethod !== undefined && { countingMethod: input.countingMethod }),
          ...(input.defaultConversionValue !== undefined && { defaultConversionValue: input.defaultConversionValue }),
        },
        retries: 3,
        baseUrlOverride: 'https://analyticsadmin.googleapis.com',
      });

      const providerEvent = ProviderConversionEventSchema.parse(response.data);

      return {
        name: providerEvent.name,
        eventName: providerEvent.eventName,
        ...(providerEvent.createTime !== undefined && { createTime: providerEvent.createTime }),
        ...(providerEvent.deletable !== undefined && { deletable: providerEvent.deletable }),
        ...(providerEvent.custom !== undefined && { custom: providerEvent.custom }),
        ...(providerEvent.countingMethod !== undefined && { countingMethod: providerEvent.countingMethod }),
        ...(providerEvent.defaultConversionValue !== undefined && {
          defaultConversionValue: providerEvent.defaultConversionValue,
        }),
      };
    },
  });
}
