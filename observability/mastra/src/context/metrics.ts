/**
 * MetricsContextImpl - User-facing metric emission API.
 *
 * All metrics are validated, cardinality-filtered, and constructed here
 * before being routed through ObservabilityBus.emit().
 * CorrelationContext and metadata are snapshotted at construction time.
 */

import { generateSignalId } from '@mastra/core/observability';
import type {
  MetricsContext,
  Counter,
  Gauge,
  Histogram,
  CorrelationContext,
  CostContext,
  ExportedMetric,
  MetricEvent,
  MetricEmitOptions,
} from '@mastra/core/observability';

import type { ObservabilityBus } from '../bus';
import type { CardinalityFilter } from '../metrics/cardinality';

/** Configuration for creating a MetricsContextImpl. */
export interface MetricsContextConfig {
  /** Top-level trace identity for emitted metric events */
  traceId?: string;

  /** Top-level span identity for emitted metric events */
  spanId?: string;

  /** Canonical correlation context derived from the current span */
  correlationContext?: CorrelationContext;

  /** Non-canonical metadata to attach to emitted metric events */
  metadata?: Record<string, unknown>;

  /** Cardinality filter applied to emitted metric labels */
  cardinalityFilter: CardinalityFilter;

  /** Bus for event emission */
  observabilityBus: ObservabilityBus;
}

/**
 * User-facing metric emission API. All metrics are routed through
 * ObservabilityBus.emit() after validation and cardinality filtering.
 */
export class MetricsContextImpl implements MetricsContext {
  private traceId?: string;
  private spanId?: string;
  private correlationContext?: CorrelationContext;
  private metadata?: Record<string, unknown>;
  private cardinalityFilter: CardinalityFilter;
  private observabilityBus: ObservabilityBus;

  /**
   * Create a metrics context. Correlation context and metadata are defensively
   * copied so mutations after construction do not affect emitted metrics.
   */
  constructor(config: MetricsContextConfig) {
    this.correlationContext = config.correlationContext ? { ...config.correlationContext } : undefined;
    this.traceId = config.traceId ?? this.correlationContext?.traceId;
    this.spanId = config.spanId ?? this.correlationContext?.spanId;
    this.metadata = config.metadata ? structuredClone(config.metadata) : undefined;
    this.cardinalityFilter = config.cardinalityFilter;
    this.observabilityBus = config.observabilityBus;
  }

  /** Emit a metric observation. */
  emit(name: string, value: number, labels?: Record<string, string>, options?: MetricEmitOptions): void {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }

    const filteredLabels = labels ? this.cardinalityFilter.filterLabels(labels) : {};
    const costContext = options?.costContext ? cloneCostContext(options.costContext) : undefined;

    const exportedMetric: ExportedMetric = {
      metricId: generateSignalId(),
      timestamp: new Date(),
      traceId: this.traceId,
      spanId: this.spanId,
      name,
      value,
      labels: filteredLabels,
      correlationContext: this.correlationContext,
      costContext,
      metadata: this.metadata,
    };

    const event: MetricEvent = { type: 'metric', metric: exportedMetric };
    this.observabilityBus.emit(event);
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

function cloneCostContext(costContext: CostContext): CostContext {
  return {
    provider: costContext.provider,
    model: costContext.model,
    estimatedCost: costContext.estimatedCost,
    costUnit: costContext.costUnit,
    costMetadata: costContext.costMetadata ? structuredClone(costContext.costMetadata) : undefined,
  };
}
