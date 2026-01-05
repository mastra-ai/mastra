/**
 * Prometheus Metrics Collector
 *
 * Implements BaseMetricsCollector for Prometheus, exposing agentic metrics
 * in a format that can be scraped by Prometheus.
 */

import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import {
  BaseMetricsCollector,
  MetricNames,
  type MetricLabels,
  type IExposableMetricsCollector,
} from '@mastra/core/observability';

export interface PrometheusCollectorOptions {
  /**
   * Custom Prometheus registry. If not provided, a new registry is created.
   */
  registry?: Registry;

  /**
   * Prefix for all metric names. Defaults to 'mastra_'.
   */
  prefix?: string;

  /**
   * Whether to collect default Node.js metrics (memory, CPU, etc.).
   * Defaults to true.
   */
  collectDefaultMetrics?: boolean;

  /**
   * Custom histogram buckets for duration metrics (in milliseconds).
   * Defaults to exponential buckets suitable for latency tracking.
   */
  durationBuckets?: number[];

  /**
   * Custom histogram buckets for token count metrics.
   */
  tokenBuckets?: number[];
}

/**
 * Prometheus metrics collector for Mastra agentic applications.
 *
 * @example
 * ```typescript
 * import { PrometheusMetricsCollector } from '@mastra/prometheus';
 *
 * const metrics = new PrometheusMetricsCollector({
 *   prefix: 'myapp_',
 *   collectDefaultMetrics: true,
 * });
 *
 * // Use with Mastra
 * const mastra = new Mastra({
 *   metrics,
 *   // ...
 * });
 *
 * // Expose metrics endpoint
 * app.get('/metrics', async (req, res) => {
 *   res.set('Content-Type', metrics.getContentType());
 *   res.end(await metrics.getMetrics());
 * });
 * ```
 */
export class PrometheusMetricsCollector extends BaseMetricsCollector implements IExposableMetricsCollector {
  private registry: Registry;
  private prefix: string;
  private counters: Map<string, Counter<string>> = new Map();
  private gauges: Map<string, Gauge<string>> = new Map();
  private histograms: Map<string, Histogram<string>> = new Map();
  private durationBuckets: number[];
  private tokenBuckets: number[];

  constructor(options: PrometheusCollectorOptions = {}) {
    super();
    this.prefix = options.prefix ?? 'mastra_';
    this.registry = options.registry ?? new Registry();

    // Default buckets for latency (ms): 10ms to 5min
    this.durationBuckets = options.durationBuckets ?? [
      10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000, 120000, 300000,
    ];

    // Default buckets for token counts
    this.tokenBuckets = options.tokenBuckets ?? [
      10, 50, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000,
    ];

    if (options.collectDefaultMetrics !== false) {
      collectDefaultMetrics({ register: this.registry, prefix: this.prefix });
    }

    // Pre-register core agentic metrics
    this.registerCoreMetrics();
  }

  /**
   * Pre-register the core Mastra metrics with proper types and descriptions.
   */
  private registerCoreMetrics(): void {
    // Agent metrics
    this.getOrCreateCounter(MetricNames.AGENT_RUNS_TOTAL, 'Total number of agent runs', ['agentId']);
    this.getOrCreateCounter(MetricNames.AGENT_RUNS_SUCCESS, 'Successful agent runs', ['agentId']);
    this.getOrCreateCounter(MetricNames.AGENT_RUNS_ERROR, 'Failed agent runs', ['agentId', 'errorType']);
    this.getOrCreateHistogram(
      MetricNames.AGENT_RUN_DURATION,
      'Agent run duration in milliseconds',
      ['agentId'],
      this.durationBuckets,
    );
    this.getOrCreateCounter(MetricNames.AGENT_TOOL_CALLS, 'Total tool calls by agents', ['agentId']);

    // Token metrics
    this.getOrCreateCounter(MetricNames.TOKENS_INPUT, 'Input tokens consumed', ['agentId', 'model']);
    this.getOrCreateCounter(MetricNames.TOKENS_OUTPUT, 'Output tokens generated', ['agentId', 'model']);
    this.getOrCreateCounter(MetricNames.TOKENS_CACHED, 'Cached tokens used', ['agentId', 'model']);
    this.getOrCreateCounter(MetricNames.TOKENS_REASONING, 'Reasoning tokens used', ['agentId', 'model']);

    // Tool metrics - labels match BaseMetricsCollector
    this.getOrCreateCounter(MetricNames.TOOL_CALLS_TOTAL, 'Total tool executions', ['tool', 'toolType', 'agentId']);
    this.getOrCreateCounter(MetricNames.TOOL_CALLS_SUCCESS, 'Successful tool executions', [
      'tool',
      'toolType',
      'agentId',
    ]);
    this.getOrCreateCounter(MetricNames.TOOL_CALLS_ERROR, 'Failed tool executions', ['tool', 'toolType', 'agentId']);
    this.getOrCreateHistogram(
      MetricNames.TOOL_CALL_DURATION,
      'Tool execution duration in milliseconds',
      ['tool', 'toolType', 'agentId'],
      this.durationBuckets,
    );

    // Workflow metrics
    this.getOrCreateCounter(MetricNames.WORKFLOW_RUNS_TOTAL, 'Total workflow runs', ['workflowId']);
    this.getOrCreateHistogram(
      MetricNames.WORKFLOW_RUN_DURATION,
      'Workflow run duration in milliseconds',
      ['workflowId'],
      this.durationBuckets,
    );
    this.getOrCreateCounter(MetricNames.WORKFLOW_STEPS_EXECUTED, 'Workflow steps executed', ['workflowId']);

    // Model metrics
    this.getOrCreateCounter(MetricNames.MODEL_CALLS_TOTAL, 'Total model calls', ['model', 'provider']);
    this.getOrCreateCounter(MetricNames.MODEL_CALLS_SUCCESS, 'Successful model calls', ['model', 'provider']);
    this.getOrCreateCounter(MetricNames.MODEL_CALLS_ERROR, 'Failed model calls', ['model', 'provider', 'errorType']);
    this.getOrCreateHistogram(
      MetricNames.MODEL_CALL_DURATION,
      'Model call duration in milliseconds',
      ['model', 'provider'],
      this.durationBuckets,
    );
    this.getOrCreateHistogram(
      MetricNames.MODEL_TIME_TO_FIRST_TOKEN,
      'Time to first token in milliseconds',
      ['model', 'provider'],
      this.durationBuckets,
    );

    // Agentic-specific metrics - labels match BaseMetricsCollector
    this.getOrCreateCounter(MetricNames.GUARDRAIL_TRIGGERS, 'Guardrail trigger events', ['agentId', 'processorId']);
    this.getOrCreateCounter(MetricNames.GUARDRAIL_BLOCKS, 'Guardrail blocks', ['agentId', 'processorId']);
    this.getOrCreateCounter(MetricNames.HUMAN_APPROVALS_REQUESTED, 'Human approval requests', ['agentId']);
    this.getOrCreateCounter(MetricNames.HUMAN_APPROVALS_GRANTED, 'Human approvals granted', ['agentId']);
    this.getOrCreateCounter(MetricNames.HUMAN_APPROVALS_DENIED, 'Human approvals denied', ['agentId']);
    this.getOrCreateCounter(MetricNames.GOAL_COMPLETED, 'Goals completed', ['agentId']);
    this.getOrCreateCounter(MetricNames.GOAL_FAILED, 'Goals failed', ['agentId']);
    this.getOrCreateCounter(MetricNames.GOAL_BLOCKED, 'Goals blocked', ['agentId']);
    this.getOrCreateCounter(MetricNames.GOAL_INCOMPLETE, 'Goals incomplete', ['agentId']);
    this.getOrCreateCounter(MetricNames.GOAL_ABANDONED, 'Goals abandoned', ['agentId']);
    this.getOrCreateCounter(MetricNames.THINKING_STEPS, 'Thinking/reasoning steps', ['agentId']);
    this.getOrCreateCounter(MetricNames.ACTION_STEPS, 'Action steps (with tool calls)', ['agentId']);
    this.getOrCreateCounter(MetricNames.BACKTRACK_COUNT, 'Backtrack events', ['agentId']);

    // Cost metrics
    this.getOrCreateCounter(MetricNames.COST_USD, 'Total cost in USD', ['agentId', 'model']);

    // HTTP metrics
    this.getOrCreateCounter(MetricNames.HTTP_REQUESTS_TOTAL, 'Total HTTP requests', ['method', 'direction', 'source']);
    this.getOrCreateCounter(MetricNames.HTTP_REQUESTS_SUCCESS, 'Successful HTTP requests', [
      'method',
      'direction',
      'source',
    ]);
    this.getOrCreateCounter(MetricNames.HTTP_REQUESTS_ERROR, 'Failed HTTP requests', [
      'method',
      'direction',
      'source',
      'statusCode',
    ]);
    this.getOrCreateHistogram(
      MetricNames.HTTP_REQUEST_DURATION,
      'HTTP request duration in milliseconds',
      ['method', 'direction', 'source'],
      this.durationBuckets,
    );
  }

  /**
   * Get or create a counter metric.
   */
  private getOrCreateCounter(name: string, help: string, labelNames: string[] = []): Counter<string> {
    const fullName = this.prefix + name;
    let counter = this.counters.get(fullName);

    if (!counter) {
      counter = new Counter({
        name: fullName,
        help,
        labelNames,
        registers: [this.registry],
      });
      this.counters.set(fullName, counter);
    }

    return counter;
  }

  /**
   * Get or create a gauge metric.
   */
  private getOrCreateGauge(name: string, help: string, labelNames: string[] = []): Gauge<string> {
    const fullName = this.prefix + name;
    let gauge = this.gauges.get(fullName);

    if (!gauge) {
      gauge = new Gauge({
        name: fullName,
        help,
        labelNames,
        registers: [this.registry],
      });
      this.gauges.set(fullName, gauge);
    }

    return gauge;
  }

  /**
   * Get or create a histogram metric.
   */
  private getOrCreateHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets?: number[],
  ): Histogram<string> {
    const fullName = this.prefix + name;
    let histogram = this.histograms.get(fullName);

    if (!histogram) {
      histogram = new Histogram({
        name: fullName,
        help,
        labelNames,
        buckets: buckets ?? this.durationBuckets,
        registers: [this.registry],
      });
      this.histograms.set(fullName, histogram);
    }

    return histogram;
  }

  /**
   * Convert MetricLabels to a record suitable for prom-client.
   */
  private labelsToRecord(labels?: MetricLabels): Record<string, string> {
    if (!labels) return {};

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      if (value !== undefined && value !== null) {
        result[key] = String(value);
      }
    }
    return result;
  }

  // ============================================================================
  // BaseMetricsCollector Abstract Method Implementations
  // ============================================================================

  /**
   * Increment a counter metric.
   */
  incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
    const fullName = this.prefix + name;
    let counter = this.counters.get(fullName);

    if (!counter) {
      // Create counter on-the-fly for custom metrics
      counter = this.getOrCreateCounter(name, `Counter: ${name}`, labels ? Object.keys(labels) : []);
    }

    // prom-client requires exact label match, so recreate if labels changed
    try {
      counter.inc(this.labelsToRecord(labels), value);
    } catch {
      // Label mismatch - recreate with new labels
      this.counters.delete(fullName);
      this.registry.removeSingleMetric(fullName);
      counter = this.getOrCreateCounter(name, `Counter: ${name}`, labels ? Object.keys(labels) : []);
      counter.inc(this.labelsToRecord(labels), value);
    }
  }

  /**
   * Set a gauge metric value.
   */
  setGauge(name: string, labels: MetricLabels, value: number): void {
    const fullName = this.prefix + name;
    let gauge = this.gauges.get(fullName);

    if (!gauge) {
      gauge = this.getOrCreateGauge(name, `Gauge: ${name}`, Object.keys(labels));
    }

    try {
      gauge.set(this.labelsToRecord(labels), value);
    } catch {
      // Label mismatch - recreate with new labels
      this.gauges.delete(fullName);
      this.registry.removeSingleMetric(fullName);
      gauge = this.getOrCreateGauge(name, `Gauge: ${name}`, Object.keys(labels));
      gauge.set(this.labelsToRecord(labels), value);
    }
  }

  /**
   * Record a histogram observation.
   */
  recordHistogram(name: string, labels: MetricLabels, value: number): void {
    const fullName = this.prefix + name;
    let histogram = this.histograms.get(fullName);

    if (!histogram) {
      histogram = this.getOrCreateHistogram(name, `Histogram: ${name}`, Object.keys(labels));
    }

    try {
      histogram.observe(this.labelsToRecord(labels), value);
    } catch {
      // Label mismatch - recreate with new labels
      this.histograms.delete(fullName);
      this.registry.removeSingleMetric(fullName);
      histogram = this.getOrCreateHistogram(name, `Histogram: ${name}`, Object.keys(labels));
      histogram.observe(this.labelsToRecord(labels), value);
    }
  }

  /**
   * Flush metrics. For Prometheus, this is a no-op since metrics are pulled.
   */
  async flush(): Promise<void> {
    // Prometheus uses a pull model, nothing to flush
  }

  /**
   * Shutdown and clear the registry.
   */
  async shutdown(): Promise<void> {
    this.registry.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  // ============================================================================
  // Prometheus-specific Methods
  // ============================================================================

  /**
   * Get the Prometheus registry for custom configuration.
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Get metrics in Prometheus text format for scraping.
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get the content type for the metrics endpoint.
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metrics. Useful for testing.
   */
  reset(): void {
    this.registry.resetMetrics();
  }
}
