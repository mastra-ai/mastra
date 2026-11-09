// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DimensionSchema = z.object({
  name: z.string(),
});

const MetricSchema = z.object({
  name: z.string(),
});

const DateRangeSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});

const OrderBySchema = z.object({
  dimension: z
    .object({
      dimensionName: z.string(),
    })
    .optional(),
  metric: z
    .object({
      metricName: z.string(),
    })
    .optional(),
  desc: z.boolean().optional(),
});

export const runReportInputSchema = z.object({
  property: z.string().describe('GA4 property ID. Example: "properties/123456789" or "123456789"'),
  dimensions: z.array(DimensionSchema).optional(),
  metrics: z.array(MetricSchema).optional(),
  dateRanges: z.array(DateRangeSchema).optional(),
  dimensionFilter: z.object({}).passthrough().optional(),
  metricFilter: z.object({}).passthrough().optional(),
  ordering: z.array(OrderBySchema).optional(),
  limit: z.number().optional(),
});

const DimensionHeaderSchema = z.object({
  name: z.string().optional(),
});

const MetricHeaderSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
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

export const runReportOutputSchema = z.object({
  dimensionHeaders: z.array(DimensionHeaderSchema).optional(),
  metricHeaders: z.array(MetricHeaderSchema).optional(),
  rows: z.array(RowSchema).optional(),
  rowCount: z.number().optional(),
  totals: z.array(RowSchema).optional(),
  maximums: z.array(RowSchema).optional(),
  minimums: z.array(RowSchema).optional(),
});

export function runReportTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_run_report',
    description: 'Run a GA4 report for a property',
    inputSchema: runReportInputSchema,
    outputSchema: runReportOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof runReportOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const propertyNumericId = input.property.replace(/^properties\//, '');

      const response = await platformProxy.post({
        // https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport
        endpoint: `/v1beta/properties/${encodeURIComponent(propertyNumericId)}:runReport`,
        baseUrlOverride: 'https://analyticsdata.googleapis.com',
        data: {
          ...(input.dimensions !== undefined && { dimensions: input.dimensions }),
          ...(input.metrics !== undefined && { metrics: input.metrics }),
          ...(input.dateRanges !== undefined && { dateRanges: input.dateRanges }),
          ...(input.dimensionFilter !== undefined && { dimensionFilter: input.dimensionFilter }),
          ...(input.metricFilter !== undefined && { metricFilter: input.metricFilter }),
          ...(input.ordering !== undefined && { orderBys: input.ordering }),
          ...(input.limit !== undefined && { limit: input.limit }),
        },
        retries: 3,
      });

      const providerResponse = z
        .object({
          dimensionHeaders: z.array(z.object({ name: z.string().optional() })).optional(),
          metricHeaders: z.array(z.object({ name: z.string().optional(), type: z.string().optional() })).optional(),
          rows: z
            .array(
              z.object({
                dimensionValues: z.array(z.object({ value: z.string().optional() })).optional(),
                metricValues: z.array(z.object({ value: z.string().optional() })).optional(),
              }),
            )
            .optional(),
          rowCount: z.number().optional(),
          totals: z
            .array(
              z.object({
                dimensionValues: z.array(z.object({ value: z.string().optional() })).optional(),
                metricValues: z.array(z.object({ value: z.string().optional() })).optional(),
              }),
            )
            .optional(),
          maximums: z
            .array(
              z.object({
                dimensionValues: z.array(z.object({ value: z.string().optional() })).optional(),
                metricValues: z.array(z.object({ value: z.string().optional() })).optional(),
              }),
            )
            .optional(),
          minimums: z
            .array(
              z.object({
                dimensionValues: z.array(z.object({ value: z.string().optional() })).optional(),
                metricValues: z.array(z.object({ value: z.string().optional() })).optional(),
              }),
            )
            .optional(),
        })
        .parse(response.data);

      return {
        dimensionHeaders: providerResponse.dimensionHeaders,
        metricHeaders: providerResponse.metricHeaders,
        rows: providerResponse.rows,
        rowCount: providerResponse.rowCount,
        totals: providerResponse.totals,
        maximums: providerResponse.maximums,
        minimums: providerResponse.minimums,
      };
    },
  });
}
