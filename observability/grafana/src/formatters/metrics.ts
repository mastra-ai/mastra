/**
 * Metrics formatter for Grafana Mimir via Prometheus Remote Write.
 *
 * Converts Mastra ExportedMetric to Prometheus Remote Write format
 * (protobuf + snappy compression). This uses Mimir's native ingestion
 * protocol rather than OTLP, differentiating @mastra/grafana from
 * @mastra/otel-exporter.
 *
 * Endpoint: POST /api/prom/push (Grafana Cloud) or /api/v1/push (self-hosted Mimir)
 * Content-Type: application/x-protobuf
 * Content-Encoding: snappy
 *
 * @see https://prometheus.io/docs/specs/prw/remote_write_spec/
 * @see https://grafana.com/docs/mimir/latest/references/http-api/#remote-write
 */

import type { ExportedMetric } from '@mastra/core/observability';
import SnappyJS from 'snappyjs';

import type { PromLabel, PromTimeSeries, PromWriteRequest } from './protobuf.js';
import { encodeWriteRequest } from './protobuf.js';

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
 * Build Prometheus labels from a metric's name, labels, and service name.
 * Prometheus requires `__name__` as the metric name label.
 * Labels are sorted by name for consistent ordering.
 */
function buildLabels(
  metricName: string,
  metricLabels: Record<string, string>,
  serviceName: string,
): PromLabel[] {
  const labels: PromLabel[] = [
    { name: '__name__', value: metricName },
    { name: 'job', value: serviceName },
  ];

  for (const [k, v] of Object.entries(metricLabels)) {
    labels.push({ name: k, value: v });
  }

  // Prometheus convention: labels sorted by name
  labels.sort((a, b) => a.name.localeCompare(b.name));
  return labels;
}

/**
 * Convert a counter or gauge metric to a single Prometheus time series.
 */
function convertSimpleMetric(
  metric: ExportedMetric,
  serviceName: string,
): PromTimeSeries[] {
  return [
    {
      labels: buildLabels(metric.name, metric.labels, serviceName),
      samples: [
        {
          value: metric.value,
          timestampMs: metric.timestamp.getTime(),
        },
      ],
    },
  ];
}

/**
 * Convert a histogram metric to Prometheus classic histogram time series.
 *
 * A single histogram observation is decomposed into:
 * - `{name}_bucket{le="X"}` for each bucket boundary (cumulative)
 * - `{name}_bucket{le="+Inf"}` (always 1 for a single observation)
 * - `{name}_sum` — the observed value
 * - `{name}_count` — always 1 for a single observation
 */
function convertHistogramMetric(
  metric: ExportedMetric,
  serviceName: string,
): PromTimeSeries[] {
  const buckets = selectBuckets(metric.name);
  const timestampMs = metric.timestamp.getTime();
  const series: PromTimeSeries[] = [];

  // Cumulative bucket counts: a value of 250 with buckets [100, 500, 1000]
  // → le="100": 0, le="500": 1, le="1000": 1, le="+Inf": 1
  let cumulative = 0;
  for (const bound of buckets) {
    if (metric.value <= bound) {
      cumulative = 1;
    }
    series.push({
      labels: buildLabels(
        `${metric.name}_bucket`,
        { ...metric.labels, le: String(bound) },
        serviceName,
      ),
      samples: [{ value: cumulative, timestampMs }],
    });
  }

  // +Inf bucket (always includes all observations)
  series.push({
    labels: buildLabels(
      `${metric.name}_bucket`,
      { ...metric.labels, le: '+Inf' },
      serviceName,
    ),
    samples: [{ value: 1, timestampMs }],
  });

  // _sum
  series.push({
    labels: buildLabels(`${metric.name}_sum`, metric.labels, serviceName),
    samples: [{ value: metric.value, timestampMs }],
  });

  // _count
  series.push({
    labels: buildLabels(`${metric.name}_count`, metric.labels, serviceName),
    samples: [{ value: 1, timestampMs }],
  });

  return series;
}

/**
 * Convert a single ExportedMetric to Prometheus time series.
 */
function convertMetric(metric: ExportedMetric, serviceName: string): PromTimeSeries[] {
  switch (metric.metricType) {
    case 'counter':
    case 'gauge':
      return convertSimpleMetric(metric, serviceName);
    case 'histogram':
      return convertHistogramMetric(metric, serviceName);
    default:
      // Fallback: treat unknown as gauge
      return convertSimpleMetric(metric, serviceName);
  }
}

/**
 * Format a batch of Mastra metrics into a Prometheus Remote Write request.
 *
 * Returns the WriteRequest as a structured object (for testing).
 * Use `formatMetricsForMimirBinary` to get the snappy-compressed protobuf.
 *
 * @param metrics - The metrics to format
 * @param serviceName - The service name used as the `job` label
 * @returns The Prometheus WriteRequest structure
 */
export function formatMetricsForMimir(
  metrics: ExportedMetric[],
  serviceName: string,
): PromWriteRequest {
  const timeseries: PromTimeSeries[] = [];

  for (const metric of metrics) {
    timeseries.push(...convertMetric(metric, serviceName));
  }

  return { timeseries };
}

/**
 * Format a batch of Mastra metrics into snappy-compressed protobuf
 * for Prometheus Remote Write.
 *
 * This is the binary payload sent to Mimir/Prometheus via POST.
 *
 * @param metrics - The metrics to format
 * @param serviceName - The service name used as the `job` label
 * @returns Snappy-compressed protobuf bytes
 */
export function formatMetricsForMimirBinary(
  metrics: ExportedMetric[],
  serviceName: string,
): Uint8Array {
  const request = formatMetricsForMimir(metrics, serviceName);
  const protobuf = encodeWriteRequest(request);
  return new Uint8Array(SnappyJS.compress(protobuf));
}
