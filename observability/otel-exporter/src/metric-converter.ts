/**
 * Convert Mastra ExportedMetric to OpenTelemetry metric instruments.
 *
 * NOTE: This file is a minimal port to the new flat ExportedMetric model
 * (`{ name, value, labels, ... }` with no instrument-type discriminator).
 * The OTEL Metrics SDK still requires us to pick an instrument type per
 * metric name. Until Mastra carries explicit instrument hints, every
 * observation is recorded into a Histogram, which preserves the full
 * distribution and lets the backend choose its own aggregation.
 *
 * TODO(metrics rewrite): Once Mastra exposes a per-name instrument hint
 * (counter / gauge / histogram) or per-name aggregation policy, route
 * counters and gauges through their proper OTEL instruments instead of
 * forcing everything into Histogram.
 */

import type { ExportedMetric } from '@mastra/core/observability';
import type { Meter, Histogram as OtelHistogram, Attributes } from '@opentelemetry/api';

/**
 * Manages OTEL metric instruments, creating them lazily and caching
 * for reuse across metric events with the same name.
 */
export class MetricInstrumentCache {
  private histograms = new Map<string, OtelHistogram>();

  constructor(private readonly meter: Meter) {}

  /**
   * Record a metric observation through a (cached) OTEL Histogram.
   */
  recordMetric(metric: ExportedMetric): void {
    const attributes = convertLabels(metric.labels);
    this.getOrCreateHistogram(metric.name).record(metric.value, attributes);
  }

  private getOrCreateHistogram(name: string): OtelHistogram {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = this.meter.createHistogram(name, {
        description: `Mastra metric: ${name}`,
      });
      this.histograms.set(name, histogram);
    }
    return histogram;
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
