// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

async function getDeveloperToken(platformProxy: PlatformProxy): Promise<string | null> {
  const connection = await platformProxy.getConnection();
  const developerToken = connection.connection_config?.['developer_token'];
  return typeof developerToken === 'string' && developerToken.length > 0 ? developerToken : null;
}

export const searchStreamGoogleAdsInputSchema = z.object({
  customerId: z.string().describe('Google Ads customer ID. Example: "1781900691"'),
  query: z.string().describe('GAQL query string. Example: "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"'),
  loginCustomerId: z
    .string()
    .optional()
    .describe(
      'Manager account ID (login-customer-id) required when accessing a client account through a manager hierarchy. Example: "3608201627"',
    ),
});

const ProviderBatchSchema = z
  .object({
    results: z.array(z.record(z.string(), z.unknown())).optional(),
    fieldMask: z.string().optional(),
    summaryRow: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
    nextPageToken: z.string().optional(),
  })
  .passthrough();

export const searchStreamGoogleAdsOutputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).describe('Flattened array of GoogleAdsRow objects from all batches'),
  fieldMask: z.string().optional().describe('Field mask from the last batch'),
  summaryRow: z.record(z.string(), z.unknown()).optional().describe('Summary row from the last batch'),
  requestId: z.string().optional().describe('Request ID from the last batch'),
  nextPageToken: z.string().optional().describe('Pagination token for subsequent requests'),
});

function parseBatches(data: unknown): z.infer<typeof ProviderBatchSchema>[] {
  if (Array.isArray(data)) {
    return data.map(item => ProviderBatchSchema.parse(item));
  }

  if (data !== null && typeof data === 'object') {
    return [ProviderBatchSchema.parse(data)];
  }

  return [];
}

export function searchStreamGoogleAdsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_ads_search_stream_google_ads',
    description: 'Run a GAQL query with streamed results',
    inputSchema: searchStreamGoogleAdsInputSchema,
    outputSchema: searchStreamGoogleAdsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof searchStreamGoogleAdsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const developerToken = await getDeveloperToken(platformProxy);
      if (!developerToken) {
        throw new platformProxy.ActionError({
          type: 'missing_config',
          message: 'developer_token is required in connection config',
        });
      }

      const response = await platformProxy.post({
        // https://developers.google.com/google-ads/api/docs/reporting/streaming
        endpoint: `/v25/customers/${encodeURIComponent(input.customerId)}/googleAds:searchStream`,
        data: {
          query: input.query,
        },
        retries: 3,
        headers: {
          'developer-token': developerToken,
          ...(input.loginCustomerId && { 'login-customer-id': input.loginCustomerId }),
        },
      });

      const batches = parseBatches(response.data);

      const rows: Record<string, unknown>[] = [];
      let fieldMask: string | undefined;
      let summaryRow: Record<string, unknown> | undefined;
      let requestId: string | undefined;
      let nextPageToken: string | undefined;

      for (const batch of batches) {
        if (batch.results) {
          rows.push(...batch.results);
        }
        if (batch.fieldMask) {
          fieldMask = batch.fieldMask;
        }
        if (batch.summaryRow) {
          summaryRow = batch.summaryRow;
        }
        if (batch.requestId) {
          requestId = batch.requestId;
        }
        if (batch.nextPageToken) {
          nextPageToken = batch.nextPageToken;
        }
      }

      return {
        rows,
        ...(fieldMask !== undefined && { fieldMask }),
        ...(summaryRow !== undefined && { summaryRow }),
        ...(requestId !== undefined && { requestId }),
        ...(nextPageToken !== undefined && { nextPageToken }),
      };
    },
  });
}
