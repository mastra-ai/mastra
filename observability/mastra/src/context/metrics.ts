/**
 * MetricsContextImpl - Metric emission with cardinality protection.
 *
 * Provides counter, gauge, and histogram instrument creation.
 * All metrics pass through cardinality filtering before emission.
 */

import type {
  MetricsContext,
  Counter,
  Gauge,
  Histogram,
  MetricType,
  ExportedMetric,
  MetricEvent,
} from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';
import type { CardinalityFilter } from '../metrics/cardinality';

export interface MetricsContextConfig {
  /** Base labels automatically added to every metric */
  baseLabels: Record<string, string>;

  /** Bus for event emission */
  observabilityBus: ObservabilityBus;

  /** Cardinality filter applied to all labels */
  cardinalityFilter: CardinalityFilter;

  /** Additional context stored in metadata (environment, serviceName, etc.) */
  context?: Record<string, unknown>;
}

export class MetricsContextImpl implements MetricsContext {
  private config: MetricsContextConfig;

  constructor(config: MetricsContextConfig) {
    this.config = config;
  }

  counter(name: string): Counter {
    return {
      add: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, 'counter', value, additionalLabels);
      },
    };
  }

  gauge(name: string): Gauge {
    return {
      set: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, 'gauge', value, additionalLabels);
      },
    };
  }

  histogram(name: string): Histogram {
    return {
      record: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, 'histogram', value, additionalLabels);
      },
    };
  }

  private emit(name: string, metricType: MetricType, value: number, additionalLabels?: Record<string, string>): void {
    const allLabels = {
      ...this.config.baseLabels,
      ...additionalLabels,
    };
    const filteredLabels = this.config.cardinalityFilter.filterLabels(allLabels);

    const exportedMetric: ExportedMetric = {
      timestamp: new Date(),
      name,
      metricType,
      value,
      labels: filteredLabels,
      metadata: this.config.context,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.config.observabilityBus.emit(event);
  }
}
