/**
 * Metrics formatter for Grafana Mimir.
 *
 * Converts Mastra ExportedMetric to OTLP/HTTP JSON format for metrics.
 * Mimir accepts metrics via the OTLP/HTTP endpoint at /otlp/v1/metrics.
 *
 * This approach avoids the complexity of Prometheus remote write (protobuf + snappy)
 * while providing full metrics support via Mimir's native OTLP ingestion.
 *
 * @see https://grafana.com/docs/mimir/latest/references/http-api/#otlp
 */

import type { ExportedMetric } from '@mastra/core/observability';

/**
 * OTLP JSON types for metrics export.
 */

interface OtlpExportMetricsRequest {
  resourceMetrics: OtlpResourceMetrics[];
}

interface OtlpResourceMetrics {
  resource: {
    attributes: OtlpKeyValue[];
  };
  scopeMetrics: OtlpScopeMetrics[];
}

interface OtlpScopeMetrics {
  scope: {
    name: string;
  };
  metrics: OtlpMetric[];
}

interface OtlpMetric {
  name: string;
  description?: string;
  unit?: string;
  sum?: OtlpSum;
  gauge?: OtlpGauge;
  histogram?: OtlpHistogram;
}

interface OtlpSum {
  dataPoints: OtlpNumberDataPoint[];
  aggregationTemporality: number;
  isMonotonic: boolean;
}

interface OtlpGauge {
  dataPoints: OtlpNumberDataPoint[];
}

interface OtlpHistogram {
  dataPoints: OtlpHistogramDataPoint[];
  aggregationTemporality: number;
}

interface OtlpNumberDataPoint {
  attributes: OtlpKeyValue[];
  timeUnixNano: string;
  asDouble?: number;
  asInt?: string;
}

interface OtlpHistogramDataPoint {
  attributes: OtlpKeyValue[];
  timeUnixNano: string;
  count: string;
  sum: number;
  explicitBounds: number[];
  bucketCounts: string[];
}

interface OtlpKeyValue {
  key: string;
  value: { stringValue?: string; intValue?: string; doubleValue?: number };
}

// OTLP aggregation temporality
const AGGREGATION_TEMPORALITY_DELTA = 1;
const AGGREGATION_TEMPORALITY_CUMULATIVE = 2;

/**
 * Default histogram bucket boundaries for duration metrics (ms).
 */
const DURATION_BUCKETS = [10, 50, 100, 500, 1000, 5000, 15000, 60000, 300000, 900000, 3600000];

/**
 * Default histogram bucket boundaries for token count metrics.
 */
const TOKEN_BUCKETS = [128, 512, 2048, 8192, 32768, 131072, 524288, 2097152];

/**
 * Default histogram bucket boundaries for generic values.
 */
const GENERIC_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000];

/**
 * Convert a Date to nanoseconds as a string.
 */
function dateToNanoString(date: Date): string {
  return `${BigInt(date.getTime()) * 1_000_000n}`;
}

/**
 * Convert labels to OTLP key-value pairs.
 */
function labelsToAttributes(labels: Record<string, string>): OtlpKeyValue[] {
  return Object.entries(labels).map(([key, value]) => ({
    key,
    value: { stringValue: value },
  }));
}

/**
 * Select appropriate histogram buckets based on metric name.
 */
function selectBuckets(metricName: string): number[] {
  if (metricName.includes('duration') || metricName.includes('latency')) {
    return DURATION_BUCKETS;
  }
  if (metricName.includes('token')) {
    return TOKEN_BUCKETS;
  }
  return GENERIC_BUCKETS;
}

/**
 * Convert a single histogram observation into a histogram data point.
 * For single observations, we place the value into the appropriate bucket.
 */
function createHistogramDataPoint(
  metric: ExportedMetric,
  buckets: number[],
): OtlpHistogramDataPoint {
  const bucketCounts = new Array(buckets.length + 1).fill(0);

  // Place the value in the correct bucket
  let placed = false;
  for (let i = 0; i < buckets.length; i++) {
    if (metric.value <= buckets[i]!) {
      bucketCounts[i]++;
      placed = true;
      break;
    }
  }
  if (!placed) {
    // Value exceeds all bucket boundaries, goes in overflow bucket
    bucketCounts[buckets.length]++;
  }

  return {
    attributes: labelsToAttributes(metric.labels),
    timeUnixNano: dateToNanoString(metric.timestamp),
    count: '1',
    sum: metric.value,
    explicitBounds: buckets,
    bucketCounts: bucketCounts.map(String),
  };
}

/**
 * Convert a single ExportedMetric to an OTLP Metric structure.
 */
function convertMetricToOtlp(metric: ExportedMetric): OtlpMetric {
  const attributes = labelsToAttributes(metric.labels);
  const timeUnixNano = dateToNanoString(metric.timestamp);

  switch (metric.metricType) {
    case 'counter':
      return {
        name: metric.name,
        sum: {
          dataPoints: [
            {
              attributes,
              timeUnixNano,
              asDouble: metric.value,
            },
          ],
          aggregationTemporality: AGGREGATION_TEMPORALITY_DELTA,
          isMonotonic: true,
        },
      };

    case 'gauge':
      return {
        name: metric.name,
        gauge: {
          dataPoints: [
            {
              attributes,
              timeUnixNano,
              asDouble: metric.value,
            },
          ],
        },
      };

    case 'histogram': {
      const buckets = selectBuckets(metric.name);
      return {
        name: metric.name,
        histogram: {
          dataPoints: [createHistogramDataPoint(metric, buckets)],
          aggregationTemporality: AGGREGATION_TEMPORALITY_DELTA,
        },
      };
    }

    default:
      // Fallback: treat unknown as gauge
      return {
        name: metric.name,
        gauge: {
          dataPoints: [
            {
              attributes,
              timeUnixNano,
              asDouble: metric.value,
            },
          ],
        },
      };
  }
}

/**
 * Format a batch of Mastra metrics into an OTLP ExportMetricsServiceRequest (JSON).
 *
 * @param metrics - The metrics to format
 * @param serviceName - The service name for the resource
 * @returns The OTLP JSON request body
 */
export function formatMetricsForMimir(
  metrics: ExportedMetric[],
  serviceName: string,
): OtlpExportMetricsRequest {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } },
            { key: 'telemetry.sdk.name', value: { stringValue: '@mastra/grafana' } },
            { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } },
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: '@mastra/grafana',
            },
            metrics: metrics.map(convertMetricToOtlp),
          },
        ],
      },
    ],
  };
}
