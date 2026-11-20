// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

const DimensionSchema = z.object({
  name: z.string(),
});

const MetricSchema = z.object({
  name: z.string(),
});

const ReportRequestSchema = z
  .object({
    dimensions: z.array(DimensionSchema).optional(),
    metrics: z.array(MetricSchema).optional(),
    dateRanges: z.array(DateRangeSchema).optional(),
    offset: z.string().optional(),
    limit: z.string().optional(),
    keepEmptyRows: z.boolean().optional(),
    returnPropertyQuota: z.boolean().optional(),
  })
  .passthrough();

export const batchRunReportsInputSchema = z.object({
  property: z.string().describe('Google Analytics property ID. Example: "properties/123456789"'),
  requests: z.array(ReportRequestSchema).min(1).max(5),
});

const DimensionValueSchema = z.object({
  value: z.string().optional(),
});

const MetricValueSchema = z.object({
  value: z.string().optional(),
});

const RowSchema = z.object({
  dimensionValues: z.array(DimensionValueSchema).optional(),
  metricValues: z.array(MetricValueSchema).optional(),
});

const DimensionHeaderSchema = z.object({
  name: z.string().optional(),
});

const MetricHeaderSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
});

const RunReportResponseSchema = z.object({
  dimensionHeaders: z.array(DimensionHeaderSchema).optional(),
  metricHeaders: z.array(MetricHeaderSchema).optional(),
  rows: z.array(RowSchema).optional(),
  totals: z.array(RowSchema).optional(),
  maximums: z.array(RowSchema).optional(),
  minimums: z.array(RowSchema).optional(),
  rowCount: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  propertyQuota: z.record(z.string(), z.unknown()).optional(),
  kind: z.string().optional(),
});

export const batchRunReportsOutputSchema = z.object({
  reports: z.array(RunReportResponseSchema),
  kind: z.string().optional(),
});

export function batchRunReportsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_batch_run_reports',
    description: 'Run multiple GA4 reports in one request.',
    inputSchema: batchRunReportsInputSchema,
    outputSchema: batchRunReportsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof batchRunReportsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const propertyId = input.property.replace(/^properties\//, '');

      const response = await platformProxy.post({
        // https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/batchRunReports
        endpoint: `/v1beta/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
        baseUrlOverride: 'https://analyticsdata.googleapis.com',
        data: {
          requests: input.requests,
        },
        retries: 3,
      });

      const providerResponse = z
        .object({
          reports: z.array(z.unknown()).optional(),
          kind: z.string().optional(),
        })
        .parse(response.data);

      return {
        reports: providerResponse.reports?.map((report: unknown) => RunReportResponseSchema.parse(report)) ?? [],
        kind: providerResponse.kind,
      };
    },
  });
}
