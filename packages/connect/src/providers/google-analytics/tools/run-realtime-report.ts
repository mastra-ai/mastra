// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const DimensionSchema = z.object({
  name: z.string().optional(),
});

const MetricSchema = z.object({
  name: z.string().optional(),
  expression: z.string().optional(),
  invisible: z.boolean().optional(),
});

const FilterExpressionSchema = z.object({}).passthrough();

const OrderBySchema = z.object({}).passthrough();

const MinuteRangeSchema = z.object({
  name: z.string().optional(),
  startMinutesAgo: z.number().optional(),
  endMinutesAgo: z.number().optional(),
});

export const runRealtimeReportInputSchema = z.object({
  property: z.string().describe('A Google Analytics property identifier. Example: "properties/1234"'),
  dimensions: z.array(DimensionSchema).optional(),
  metrics: z.array(MetricSchema).optional(),
  dimensionFilter: FilterExpressionSchema.optional(),
  metricFilter: FilterExpressionSchema.optional(),
  limit: z.string().optional().describe('The number of rows to return. If unspecified, 10,000 rows are returned.'),
  metricAggregations: z.array(z.string()).optional(),
  orderBys: z.array(OrderBySchema).optional(),
  returnPropertyQuota: z.boolean().optional(),
  minuteRanges: z.array(MinuteRangeSchema).optional(),
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
  oneValue: z.string().optional(),
});

const MetricValueSchema = z.object({
  value: z.string().optional(),
});

const RowSchema = z.object({
  dimensionValues: z.array(DimensionValueSchema).optional(),
  metricValues: z.array(MetricValueSchema).optional(),
});

const PropertyQuotaSchema = z.object({}).passthrough();

export const runRealtimeReportOutputSchema = z.object({
  dimensionHeaders: z.array(DimensionHeaderSchema).optional(),
  metricHeaders: z.array(MetricHeaderSchema).optional(),
  rows: z.array(RowSchema).optional(),
  totals: z.array(RowSchema).optional(),
  maximums: z.array(RowSchema).optional(),
  minimums: z.array(RowSchema).optional(),
  rowCount: z.number().optional(),
  propertyQuota: PropertyQuotaSchema.optional(),
  kind: z.string().optional(),
});

export function runRealtimeReportTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_analytics_run_realtime_report',
    description: 'Run a realtime GA4 report.',
    inputSchema: runRealtimeReportInputSchema,
    outputSchema: runRealtimeReportOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof runRealtimeReportOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const propertyParts = input.property.split('/');
      if (propertyParts.length !== 2 || propertyParts[0] !== 'properties' || !propertyParts[1]) {
        throw new platformProxy.ActionError({
          type: 'invalid_property',
          message: 'Property must be in the format "properties/{propertyId}". Example: "properties/1234"',
        });
      }
      const propertyId = encodeURIComponent(propertyParts[1]);

      const requestBody: Record<string, unknown> = {
        ...(input.dimensions !== undefined && { dimensions: input.dimensions }),
        ...(input.metrics !== undefined && { metrics: input.metrics }),
        ...(input.dimensionFilter !== undefined && { dimensionFilter: input.dimensionFilter }),
        ...(input.metricFilter !== undefined && { metricFilter: input.metricFilter }),
        ...(input.limit !== undefined && { limit: input.limit }),
        ...(input.metricAggregations !== undefined && { metricAggregations: input.metricAggregations }),
        ...(input.orderBys !== undefined && { orderBys: input.orderBys }),
        ...(input.returnPropertyQuota !== undefined && { returnPropertyQuota: input.returnPropertyQuota }),
        ...(input.minuteRanges !== undefined && { minuteRanges: input.minuteRanges }),
      };

      const response = await platformProxy.post({
        // https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runRealtimeReport
        endpoint: `/v1beta/properties/${propertyId}:runRealtimeReport`,
        baseUrlOverride: 'https://analyticsdata.googleapis.com',
        data: requestBody,
        retries: 3,
      });

      const providerResponse = runRealtimeReportOutputSchema.parse(response.data);
      return providerResponse;
    },
  });
}
