// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const searchDeveloperMetadataInputSchema = z.object({
  spreadsheetId: z.string(),
  dataFilters: z.array(
    z
      .object({
        developerMetadataLookup: z.record(z.string(), z.unknown()).optional(),
        a1Range: z.string().optional(),
        gridRange: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
  ),
});

const DeveloperMetadataSchema = z.object({
  metadataId: z.number(),
  metadataKey: z.string(),
  metadataValue: z.string(),
  location: z.record(z.string(), z.unknown()),
  visibility: z.string(),
});

const DataFilterSchema = z
  .object({
    developerMetadataLookup: z.record(z.string(), z.unknown()).optional(),
    a1Range: z.string().optional(),
    gridRange: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const MatchedDeveloperMetadataSchema = z.object({
  developerMetadata: DeveloperMetadataSchema,
  dataFilters: z.array(DataFilterSchema),
});

export const searchDeveloperMetadataOutputSchema = z.object({
  matchedDeveloperMetadata: z.array(MatchedDeveloperMetadataSchema),
});

export function searchDeveloperMetadataTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_sheet_search_developer_metadata',
    description: 'Search developer metadata by criteria',
    inputSchema: searchDeveloperMetadataInputSchema,
    outputSchema: searchDeveloperMetadataOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchDeveloperMetadataOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.developerMetadata/search
        endpoint: `/v4/spreadsheets/${input.spreadsheetId}/developerMetadata:search`,
        data: {
          dataFilters: input.dataFilters,
        },
        retries: 3,
      });

      return {
        matchedDeveloperMetadata: response.data.matchedDeveloperMetadata || [],
      };
    },
  });
}
