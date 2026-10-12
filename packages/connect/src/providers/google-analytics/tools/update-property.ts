// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updatePropertyInputSchema = z.object({
  name: z.string().describe('Property resource name. Example: "properties/123456789"'),
  displayName: z.string().optional().describe('Human-readable display name for the property.'),
  timeZone: z.string().optional().describe('The reporting time zone for the property. Example: "America/Los_Angeles".'),
  currencyCode: z.string().optional().describe('The currency type used in reports. Example: "USD".'),
  industryCategory: z.string().optional().describe('Industry category. Example: "TECHNOLOGY".'),
});

const ProviderPropertySchema = z.object({
  name: z.string(),
  createTime: z.string().optional(),
  updateTime: z.string().optional(),
  parent: z.string().optional(),
  displayName: z.string().optional(),
  industryCategory: z.string().optional(),
  timeZone: z.string().optional(),
  currencyCode: z.string().optional(),
  serviceLevel: z.string().optional(),
  account: z.string().optional(),
  propertyType: z.string().optional(),
});

export const updatePropertyOutputSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  industryCategory: z.string().optional(),
  timeZone: z.string().optional(),
  currencyCode: z.string().optional(),
  serviceLevel: z.string().optional(),
  account: z.string().optional(),
});

export function updatePropertyTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_update_property',
    description: 'Update a GA4 property.',
    inputSchema: updatePropertyInputSchema,
    outputSchema: updatePropertyOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePropertyOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const propertyId = input.name.replace(/^properties\//, '');
      if (!propertyId || propertyId.includes('/')) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'name must be a valid property resource name in the format "properties/{propertyId}".',
        });
      }

      const updateMaskFields: string[] = [];
      if (input.displayName !== undefined) {
        updateMaskFields.push('displayName');
      }
      if (input.timeZone !== undefined) {
        updateMaskFields.push('timeZone');
      }
      if (input.currencyCode !== undefined) {
        updateMaskFields.push('currencyCode');
      }
      if (input.industryCategory !== undefined) {
        updateMaskFields.push('industryCategory');
      }

      if (updateMaskFields.length === 0) {
        throw new platformProxy.ActionError({
          type: 'invalid_input',
          message: 'At least one field to update must be provided.',
        });
      }

      const response = await platformProxy.patch({
        // https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties/patch
        endpoint: `/v1beta/properties/${encodeURIComponent(propertyId)}`,
        params: {
          updateMask: updateMaskFields.join(','),
        },
        data: {
          ...(input.displayName !== undefined && { displayName: input.displayName }),
          ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
          ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode }),
          ...(input.industryCategory !== undefined && { industryCategory: input.industryCategory }),
        },
        retries: 3,
        baseUrlOverride: 'https://analyticsadmin.googleapis.com',
      });

      const providerProperty = ProviderPropertySchema.parse(response.data);

      return {
        name: providerProperty.name,
        ...(providerProperty.displayName !== undefined && { displayName: providerProperty.displayName }),
        ...(providerProperty.industryCategory !== undefined && { industryCategory: providerProperty.industryCategory }),
        ...(providerProperty.timeZone !== undefined && { timeZone: providerProperty.timeZone }),
        ...(providerProperty.currencyCode !== undefined && { currencyCode: providerProperty.currencyCode }),
        ...(providerProperty.serviceLevel !== undefined && { serviceLevel: providerProperty.serviceLevel }),
        ...(providerProperty.account !== undefined && { account: providerProperty.account }),
      };
    },
  });
}
