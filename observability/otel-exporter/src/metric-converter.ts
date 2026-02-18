/**
 * Convert Mastra ExportedMetric to OpenTelemetry metric format
 *
 * Mastra emits individual metric observations (ExportedMetric).
 * We use the OTEL Metrics SDK (MeterProvider + PeriodicExportingMetricReader)
 * to handle aggregation and export. The converter maps Mastra metric names
 * to OTEL instrument types and records values through the OTEL Meter API.
 */

import type { ExportedMetric, MetricType } from '@mastra/core/observability';
import type { Meter, Counter as OtelCounter, Histogram as OtelHistogram, Attributes } from '@opentelemetry/api';

/**
 * Manages OTEL metric instruments, creating them lazily and caching
 * for reuse across metric events with the same name.
 */
export class MetricInstrumentCache {
  private counters = new Map<string, OtelCounter>();
  private histograms = new Map<string, OtelHistogram>();
  // Gauges use ObservableGauge in OTEL, but since we get point-in-time values
  // from Mastra, we use a UpDownCounter to simulate gauge behavior, or we
  // record directly. For simplicity, we'll use a gauge approach with
  // lastValue tracking via ObservableGauge.
  private gaugeValues = new Map<string, { value: number; attributes: Attributes }>();
  private registeredGauges = new Set<string>();

  constructor(private readonly meter: Meter) {}

  /**
   * Record a metric value using the appropriate OTEL instrument
   */
  recordMetric(metric: ExportedMetric): void {
    const attributes = convertLabels(metric.labels);

    switch (metric.metricType) {
      case 'counter':
        this.getOrCreateCounter(metric.name).add(metric.value, attributes);
        break;
      case 'histogram':
        this.getOrCreateHistogram(metric.name).record(metric.value, attributes);
        break;
      case 'gauge':
        this.recordGaugeValue(metric.name, metric.value, attributes);
        break;
    }
  }

  private getOrCreateCounter(name: string): OtelCounter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = this.meter.createCounter(name, {
        description: `Mastra counter: ${name}`,
      });
      this.counters.set(name, counter);
    }
    return counter;
  }

  private getOrCreateHistogram(name: string): OtelHistogram {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = this.meter.createHistogram(name, {
        description: `Mastra histogram: ${name}`,
      });
      this.histograms.set(name, histogram);
    }
    return histogram;
  }

  /**
   * Record a gauge value. OTEL gauges are observable (callback-based),
   * so we store the latest value and register an observable gauge
   * that reports it on collection.
   */
  private recordGaugeValue(name: string, value: number, attributes: Attributes): void {
    // Store the key with attributes for unique identification
    const key = buildGaugeKey(name, attributes);
    this.gaugeValues.set(key, { value, attributes });

    // Register the observable gauge once per metric name
    if (!this.registeredGauges.has(name)) {
      this.registeredGauges.add(name);
      this.meter
        .createObservableGauge(name, {
          description: `Mastra gauge: ${name}`,
        })
        .addCallback(result => {
          // Report all stored values for this gauge name
          for (const [storedKey, entry] of this.gaugeValues) {
            if (storedKey.startsWith(name + '|')) {
              result.observe(entry.value, entry.attributes);
            }
          }
        });
    }
  }
}

/**
 * Convert Mastra metric labels to OTEL Attributes
 */
export function convertLabels(labels: Record<string, string>): Attributes {
  const attributes: Attributes = {};
  for (const [key, value] of Object.entries(labels)) {
    attributes[key] = value;
  }
  return attributes;
}

/**
 * Build a unique key for gauge values (name + sorted attributes)
 */
function buildGaugeKey(name: string, attributes: Attributes): string {
  const sortedAttrs = Object.entries(attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${name}|${sortedAttrs}`;
}

/**
 * Determine the OTEL metric instrument type for a Mastra MetricType.
 * Useful for documentation/logging purposes.
 */
export function getOtelInstrumentType(metricType: MetricType): string {
  switch (metricType) {
    case 'counter':
      return 'Counter';
    case 'gauge':
      return 'ObservableGauge';
    case 'histogram':
      return 'Histogram';
    default:
      return 'Unknown';
  }
}
