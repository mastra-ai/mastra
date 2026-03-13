/**
 * MetricsContextImpl - User-facing metric emission API.
 *
 * All metrics are routed through ObservabilityBus.emitMetric() which handles
 * validation, cardinality filtering, and event construction.
 * Context labels are snapshotted at construction time.
 */

import type { MetricsContext, Counter, Gauge, Histogram } from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';

/** Configuration for creating a MetricsContextImpl. */
export interface MetricsContextConfig {
  /** Base labels merged into every emitted metric (entity context, model, provider, serviceName, etc.) */
  labels?: Record<string, string>;

  /** Bus for event emission */
  observabilityBus: ObservabilityBus;
}

/**
 * User-facing metric emission API. All metrics are routed through
 * ObservabilityBus.emitMetric() for validation and cardinality filtering.
 */
export class MetricsContextImpl implements MetricsContext {
  private baseLabels: Record<string, string>;
  private observabilityBus: ObservabilityBus;

  /**
   * Create a metrics context. Base labels are defensively copied so
   * mutations after construction do not affect emitted metrics.
   */
  constructor(config: MetricsContextConfig) {
    this.baseLabels = config.labels ? { ...config.labels } : {};
    this.observabilityBus = config.observabilityBus;
  }

  /** Emit a metric observation. */
  emit(name: string, value: number, labels?: Record<string, string>): void {
    const allLabels = { ...this.baseLabels, ...labels };
    this.observabilityBus.emitMetric(name, value, allLabels);
  }

  /** @deprecated Use `emit()` instead. */
  counter(name: string): Counter {
    return {
      add: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, value, additionalLabels);
      },
    };
  }

  /** @deprecated Use `emit()` instead. */
  gauge(name: string): Gauge {
    return {
      set: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, value, additionalLabels);
      },
    };
  }

  /** @deprecated Use `emit()` instead. */
  histogram(name: string): Histogram {
    return {
      record: (value: number, additionalLabels?: Record<string, string>) => {
        this.emit(name, value, additionalLabels);
      },
    };
  }
}
