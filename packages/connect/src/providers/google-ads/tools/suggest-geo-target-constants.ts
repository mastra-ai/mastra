// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const suggestGeoTargetConstantsInputSchema = z
  .object({
    locale: z.string().optional().describe('Locale code. Example: "en"'),
    countryCode: z.string().optional().describe('Country code. Example: "US"'),
    locationNames: z
      .object({
        names: z.array(z.string()),
      })
      .optional()
      .describe('Location names to search by. At most 25 names can be set.'),
    geoTargetConstants: z
      .object({
        resourceNames: z.array(z.string()),
      })
      .optional()
      .describe('Geo target constant resource names to filter by.'),
  })
  .refine(data => (data.locationNames !== undefined ? 1 : 0) + (data.geoTargetConstants !== undefined ? 1 : 0) === 1, {
    message: 'Exactly one of locationNames or geoTargetConstants must be provided, not both.',
  });

const GeoTargetConstantSchema = z.object({
  resourceName: z.string(),
  id: z.string().optional(),
  name: z.string().optional(),
  countryCode: z.string().optional(),
  targetType: z.string().optional(),
  status: z.string().optional(),
  canonicalName: z.string().optional(),
});

const GeoTargetConstantSuggestionSchema = z.object({
  geoTargetConstant: GeoTargetConstantSchema,
  geoTargetConstantParents: z.array(GeoTargetConstantSchema).optional(),
  locale: z.string().optional(),
  reach: z.string().optional(),
  searchTerm: z.string().optional(),
});

const ProviderResponseSchema = z.object({
  geoTargetConstantSuggestions: z.array(GeoTargetConstantSuggestionSchema).optional(),
});

export const suggestGeoTargetConstantsOutputSchema = z.object({
  geoTargetConstantSuggestions: z.array(GeoTargetConstantSuggestionSchema),
});

export function suggestGeoTargetConstantsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_suggest_geo_target_constants',
    description:
      'Look up geo target constant resource names for location names or codes, for use in campaign location targeting.',
    inputSchema: suggestGeoTargetConstantsInputSchema,
    outputSchema: suggestGeoTargetConstantsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof suggestGeoTargetConstantsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const requestBody: Record<string, unknown> = {
        ...(input.locale !== undefined && { locale: input.locale }),
        ...(input.countryCode !== undefined && { countryCode: input.countryCode }),
        ...(input.locationNames !== undefined && { locationNames: { names: input.locationNames.names } }),
        ...(input.geoTargetConstants !== undefined && {
          geoTargets: { geoTargetConstants: input.geoTargetConstants.resourceNames },
        }),
      };

      const config: PlatformProxyRequest = {
        // https://developers.google.com/google-ads/api/rest/reference/rest/v25/geoTargetConstants/suggest
        endpoint: 'v25/geoTargetConstants:suggest',
        data: requestBody,
        headers: {
          'developer-token': developerToken,
        },
        retries: 3,
      };

      const response = await platformProxy.post(config);
      const parsed = ProviderResponseSchema.parse(response.data);

      return {
        geoTargetConstantSuggestions: parsed.geoTargetConstantSuggestions ?? [],
      };
    },
  });
}
