/**
 * OpenTelemetry Metrics Collector for Mastra
 *
 * This collector implements Mastra's IMetricsCollector interface using the
 * OpenTelemetry Metrics API, enabling export to any OTEL-compatible backend.
 */

import {
  metrics,
  type Meter,
  type Counter,
  type Histogram,
  type ObservableGauge,
  type Attributes,
  ValueType,
} from '@opentelemetry/api';
import { BaseMetricsCollector, MetricNames, type MetricLabels } from '@mastra/core/observability';

/**
 * Configuration options for the OpenTelemetry Metrics Collector
 */
export interface OtelMetricsCollectorOptions {
  /**
   * Name of the meter (instrument scope).
   * Defaults to '@mastra/otel-metrics'
   */
  meterName?: string;

  /**
   * Version of the meter.
   * Defaults to '1.0.0'
   */
  meterVersion?: string;

  /**
   * Prefix for all metric names.
   * Defaults to 'mastra_'
   */
  prefix?: string;

  /**
   * Custom histogram bucket boundaries for duration metrics (in milliseconds).
   * Defaults to standard latency buckets.
   */
  durationBuckets?: number[];

  /**
   * Custom histogram bucket boundaries for token count metrics.
   * Defaults to standard token buckets.
   */
  tokenBuckets?: number[];
}

/**
 * OpenTelemetry Metrics Collector
 *
 * Uses the OpenTelemetry Metrics API to record metrics, allowing export to
 * any OTEL-compatible backend (OTLP, Prometheus, Datadog, etc.)
 *
 * @example
 * ```typescript
 * import { OtelMetricsCollector } from '@mastra/otel-metrics';
 * import { MeterProvider } from '@opentelemetry/sdk-metrics';
 * import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
 *
 * // Set up OTEL metrics SDK (typically in your instrumentation setup)
 * const meterProvider = new MeterProvider();
 * meterProvider.addMetricReader(
 *   new PeriodicExportingMetricReader({
 *     exporter: new OTLPMetricExporter(),
 *   })
 * );
 * metrics.setGlobalMeterProvider(meterProvider);
 *
 * // Create Mastra with OTEL metrics
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   metrics: new OtelMetricsCollector(),
 * });
 * ```
 */
export class OtelMetricsCollector extends BaseMetricsCollector {
  private meter: Meter;
  private prefix: string;

  // Metric instrument caches
  private counters: Map<string, Counter<Attributes>> = new Map();
  private histograms: Map<string, Histogram<Attributes>> = new Map();
  private gaugeValues: Map<string, { value: number; attributes: Attributes }> = new Map();
  private gaugeCallbacks: Map<string, ObservableGauge<Attributes>> = new Map();

  // Bucket configurations
  private durationBuckets: number[];
  private tokenBuckets: number[];

  constructor(options: OtelMetricsCollectorOptions = {}) {
    super();

    this.prefix = options.prefix ?? 'mastra_';
    this.durationBuckets = options.durationBuckets ?? [
      10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000, 120000, 300000,
    ];
    this.tokenBuckets = options.tokenBuckets ?? [
      10, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000,
    ];

    // Get meter from global meter provider
    // Users should configure their MeterProvider before creating this collector
    this.meter = metrics.getMeter(options.meterName ?? '@mastra/otel-metrics', options.meterVersion ?? '1.0.0');

    // Register core Mastra metrics
    this.registerCoreMetrics();
  }

  /**
   * Pre-register core Mastra metrics with appropriate types and descriptions
   */
  private registerCoreMetrics(): void {
    // Agent metrics
    this.getOrCreateCounter(MetricNames.AGENT_RUNS_TOTAL, 'Total number of agent runs');
    this.getOrCreateCounter(MetricNames.AGENT_RUNS_SUCCESS, 'Total successful agent runs');
    this.getOrCreateCounter(MetricNames.AGENT_RUNS_ERROR, 'Total failed agent runs');
    this.getOrCreateHistogram(
      MetricNames.AGENT_RUN_DURATION,
      'Duration of agent runs in milliseconds',
      this.durationBuckets,
    );

    // Tool metrics
    this.getOrCreateCounter(MetricNames.TOOL_CALLS_TOTAL, 'Total number of tool calls');
    this.getOrCreateCounter(MetricNames.TOOL_CALLS_SUCCESS, 'Total successful tool calls');
    this.getOrCreateCounter(MetricNames.TOOL_CALLS_ERROR, 'Total failed tool calls');
    this.getOrCreateHistogram(
      MetricNames.TOOL_CALL_DURATION,
      'Duration of tool calls in milliseconds',
      this.durationBuckets,
    );

    // Model/LLM metrics
    this.getOrCreateCounter(MetricNames.MODEL_CALLS_TOTAL, 'Total number of model calls');
    this.getOrCreateCounter(MetricNames.MODEL_CALLS_SUCCESS, 'Total successful model calls');
    this.getOrCreateCounter(MetricNames.MODEL_CALLS_ERROR, 'Total failed model calls');
    this.getOrCreateHistogram(
      MetricNames.MODEL_CALL_DURATION,
      'Duration of model calls in milliseconds',
      this.durationBuckets,
    );
    this.getOrCreateHistogram(MetricNames.TOKENS_INPUT, 'Input tokens per model call', this.tokenBuckets);
    this.getOrCreateHistogram(MetricNames.TOKENS_OUTPUT, 'Output tokens per model call', this.tokenBuckets);

    // HTTP metrics
    this.getOrCreateCounter(MetricNames.HTTP_REQUESTS_TOTAL, 'Total number of HTTP requests');
    this.getOrCreateCounter(MetricNames.HTTP_REQUESTS_SUCCESS, 'Total successful HTTP requests');
    this.getOrCreateCounter(MetricNames.HTTP_REQUESTS_ERROR, 'Total failed HTTP requests');
    this.getOrCreateHistogram(
      MetricNames.HTTP_REQUEST_DURATION,
      'Duration of HTTP requests in milliseconds',
      this.durationBuckets,
    );

    // Workflow metrics
    this.getOrCreateCounter(MetricNames.WORKFLOW_RUNS_TOTAL, 'Total number of workflow runs');
    this.getOrCreateCounter(MetricNames.WORKFLOW_RUNS_SUCCESS, 'Total successful workflow runs');
    this.getOrCreateCounter(MetricNames.WORKFLOW_RUNS_FAILED, 'Total failed workflow runs');
    this.getOrCreateHistogram(
      MetricNames.WORKFLOW_RUN_DURATION,
      'Duration of workflow runs in milliseconds',
      this.durationBuckets,
    );

    // Agentic metrics
    this.getOrCreateCounter(MetricNames.GUARDRAIL_TRIGGERS, 'Total number of guardrail triggers');
    this.getOrCreateCounter(MetricNames.HUMAN_APPROVALS_REQUESTED, 'Total number of human approval requests');
    this.getOrCreateCounter(MetricNames.GOAL_COMPLETED, 'Total number of goals completed');
    this.getOrCreateCounter(MetricNames.GOAL_FAILED, 'Total number of goals failed');
    this.getOrCreateCounter(MetricNames.BACKTRACK_COUNT, 'Total number of agent backtracks');
  }

  /**
   * Get or create a counter instrument
   */
  private getOrCreateCounter(name: string, description?: string): Counter<Attributes> {
    const prefixedName = this.prefix + name;
    let counter = this.counters.get(prefixedName);

    if (!counter) {
      counter = this.meter.createCounter(prefixedName, {
        description: description ?? `Counter for ${name}`,
        valueType: ValueType.INT,
      });
      this.counters.set(prefixedName, counter);
    }

    return counter;
  }

  /**
   * Get or create a histogram instrument
   */
  private getOrCreateHistogram(name: string, description?: string, boundaries?: number[]): Histogram<Attributes> {
    const prefixedName = this.prefix + name;
    let histogram = this.histograms.get(prefixedName);

    if (!histogram) {
      histogram = this.meter.createHistogram(prefixedName, {
        description: description ?? `Histogram for ${name}`,
        valueType: ValueType.DOUBLE,
        advice: boundaries ? { explicitBucketBoundaries: boundaries } : undefined,
      });
      this.histograms.set(prefixedName, histogram);
    }

    return histogram;
  }

  /**
   * Set up an observable gauge for a metric
   */
  private getOrCreateGauge(name: string, description?: string): void {
    const prefixedName = this.prefix + name;

    if (this.gaugeCallbacks.has(prefixedName)) {
      return;
    }

    const gauge = this.meter.createObservableGauge(prefixedName, {
      description: description ?? `Gauge for ${name}`,
      valueType: ValueType.DOUBLE,
    });

    // Register callback that reads from gaugeValues
    gauge.addCallback(result => {
      // Find all gauge values that match this metric name
      for (const [key, { value, attributes }] of this.gaugeValues.entries()) {
        if (key.startsWith(prefixedName + ':')) {
          result.observe(value, attributes);
        }
      }
      // Also check for the base key without attributes
      const baseValue = this.gaugeValues.get(prefixedName);
      if (baseValue) {
        result.observe(baseValue.value, baseValue.attributes);
      }
    });

    this.gaugeCallbacks.set(prefixedName, gauge);
  }

  /**
   * Convert MetricLabels to OTEL Attributes
   */
  private labelsToAttributes(labels?: MetricLabels): Attributes {
    if (!labels) return {};

    const attributes: Attributes = {};
    for (const [key, value] of Object.entries(labels)) {
      if (value !== undefined && value !== null) {
        attributes[key] = String(value);
      }
    }
    return attributes;
  }

  /**
   * Generate a unique key for gauge storage
   */
  private gaugeKey(name: string, labels?: MetricLabels): string {
    const prefixedName = this.prefix + name;
    if (!labels || Object.keys(labels).length === 0) {
      return prefixedName;
    }
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${prefixedName}:${sortedLabels}`;
  }

  // ============================================================================
  // IMetricsCollector Implementation (5 primitives)
  // ============================================================================

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const counter = this.getOrCreateCounter(name);
    const attributes = this.labelsToAttributes(labels);
    counter.add(value, attributes);
  }

  /**
   * Set a gauge metric value
   *
   * Note: OTEL gauges are "observable" and read via callbacks.
   * We store the value and it's read during metric collection.
   */
  setGauge(name: string, labels: MetricLabels, value: number): void {
    // Ensure the gauge callback is registered
    this.getOrCreateGauge(name);

    // Store the value for the callback to read
    const key = this.gaugeKey(name, labels);
    const attributes = this.labelsToAttributes(labels);
    this.gaugeValues.set(key, { value, attributes });
  }

  /**
   * Record a histogram observation
   */
  recordHistogram(name: string, labels: MetricLabels, value: number): void {
    // Determine appropriate buckets based on metric name
    let boundaries: number[] | undefined;
    if (name.includes('duration') || name.includes('latency') || name.includes('time')) {
      boundaries = this.durationBuckets;
    } else if (name.includes('token')) {
      boundaries = this.tokenBuckets;
    }

    const histogram = this.getOrCreateHistogram(name, undefined, boundaries);
    const attributes = this.labelsToAttributes(labels);
    histogram.record(value, attributes);
  }

  /**
   * Flush metrics
   *
   * OTEL metrics are typically push-based via MetricReader.
   * This is a no-op as flushing is handled by the SDK.
   */
  async flush(): Promise<void> {
    // OTEL SDK handles flushing via MetricReader
    // No manual flush needed
  }

  /**
   * Shutdown the collector
   *
   * Cleans up internal state. The MeterProvider should be
   * shut down separately by the user.
   */
  async shutdown(): Promise<void> {
    this.counters.clear();
    this.histograms.clear();
    this.gaugeValues.clear();
    this.gaugeCallbacks.clear();
  }
}
