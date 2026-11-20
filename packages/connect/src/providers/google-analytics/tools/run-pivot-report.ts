// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const runPivotReportInputSchema = z.object({
  property: z.string().describe('Google Analytics property numeric ID. Example: 535258304'),
  dimensions: z.array(z.record(z.string(), z.unknown())).optional(),
  metrics: z.array(z.record(z.string(), z.unknown())).optional(),
  dateRanges: z.array(z.record(z.string(), z.unknown())).optional(),
  pivots: z.array(z.record(z.string(), z.unknown())).optional(),
  dimensionFilter: z.record(z.string(), z.unknown()).optional(),
  metricFilter: z.record(z.string(), z.unknown()).optional(),
  currencyCode: z.string().optional(),
  cohortSpec: z.record(z.string(), z.unknown()).optional(),
  keepEmptyRows: z.boolean().optional(),
  returnPropertyQuota: z.boolean().optional(),
  comparisons: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const runPivotReportOutputSchema = z
  .object({
    pivotHeaders: z.array(z.record(z.string(), z.unknown())).optional(),
    dimensionHeaders: z.array(z.record(z.string(), z.unknown())).optional(),
    metricHeaders: z.array(z.record(z.string(), z.unknown())).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    aggregates: z.array(z.record(z.string(), z.unknown())).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    propertyQuota: z.record(z.string(), z.unknown()).optional(),
    kind: z.string().optional(),
  })
  .passthrough();

export function runPivotReportTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_run_pivot_report',
    description: 'Run a GA4 pivot report.',
    inputSchema: runPivotReportInputSchema,
    outputSchema: runPivotReportOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof runPivotReportOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const { property, ...requestBody } = input;

      const response = await platformProxy.post({
        // https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runPivotReport
        endpoint: `/v1beta/properties/${encodeURIComponent(property)}:runPivotReport`,
        data: requestBody,
        baseUrlOverride: 'https://analyticsdata.googleapis.com',
        retries: 3,
      });

      const parsed = runPivotReportOutputSchema.parse(response.data);
      return parsed;
    },
  });
}
