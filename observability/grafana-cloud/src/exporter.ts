/**
 * GrafanaCloudExporter - exports traces, metrics, and logs to Grafana Cloud.
 *
 * Signal routing:
 * - Traces → Grafana Tempo (via OTLP/HTTP JSON)
 * - Metrics → Grafana Mimir (via OTLP/HTTP JSON)
 * - Logs → Grafana Loki (via JSON push API)
 *
 * Authentication uses Basic auth with `instanceId:apiKey` for all endpoints.
 *
 * Supports batching with configurable batch size and flush interval.
 * In serverless environments, call `flush()` before function termination.
 */

import { TracingEventType } from '@mastra/core/observability';
import type {
  AnyExportedSpan,
  TracingEvent,
  InitExporterOptions,
  ObservabilityInstanceConfig,
} from '@mastra/core/observability';
import type { ExportedLog, LogEvent } from '@mastra/core/observability';
import type { ExportedMetric, MetricEvent } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';

import { formatLogsForLoki } from './formatters/logs.js';
import { formatMetricsForMimir } from './formatters/metrics.js';
import { formatSpansForTempo } from './formatters/traces.js';
import type { GrafanaCloudExporterConfig } from './types.js';
import { DEFAULTS } from './types.js';

/**
 * GrafanaCloudExporter sends telemetry to Grafana Cloud's managed backends.
 *
 * Implements `onTracingEvent`, `onLogEvent`, and `onMetricEvent` handlers,
 * indicating support for all three signals (T/M/L).
 *
 * @example
 * ```typescript
 * import { GrafanaCloudExporter } from '@mastra/grafana-cloud';
 *
 * const exporter = new GrafanaCloudExporter({
 *   instanceId: process.env.GRAFANA_CLOUD_INSTANCE_ID,
 *   apiKey: process.env.GRAFANA_CLOUD_API_KEY,
 * });
 * ```
 */
export class GrafanaCloudExporter extends BaseExporter {
  readonly name = 'grafana-cloud';

  private readonly instanceId: string;
  private readonly apiKey: string;
  private readonly tempoEndpoint: string;
  private readonly mimirEndpoint: string;
  private readonly lokiEndpoint: string;
  private readonly serviceName: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;

  // Batching buffers
  private spanBuffer: AnyExportedSpan[] = [];
  private metricBuffer: ExportedMetric[] = [];
  private logBuffer: ExportedLog[] = [];

  // Flush timer
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  // Auth header (cached)
  private readonly authHeader: string;

  constructor(config: GrafanaCloudExporterConfig = {}) {
    super(config);

    // Resolve configuration from config and environment variables
    const instanceId = config.instanceId ?? process.env['GRAFANA_CLOUD_INSTANCE_ID'];
    const apiKey = config.apiKey ?? process.env['GRAFANA_CLOUD_API_KEY'];

    if (!instanceId) {
      this.instanceId = '';
      this.apiKey = '';
      this.authHeader = '';
      this.tempoEndpoint = '';
      this.mimirEndpoint = '';
      this.lokiEndpoint = '';
      this.serviceName = DEFAULTS.serviceName;
      this.batchSize = DEFAULTS.batchSize;
      this.flushIntervalMs = DEFAULTS.flushIntervalMs;
      this.setDisabled(
        'Missing instanceId. Set GRAFANA_CLOUD_INSTANCE_ID env var or pass instanceId in config.',
      );
      return;
    }

    if (!apiKey) {
      this.instanceId = '';
      this.apiKey = '';
      this.authHeader = '';
      this.tempoEndpoint = '';
      this.mimirEndpoint = '';
      this.lokiEndpoint = '';
      this.serviceName = DEFAULTS.serviceName;
      this.batchSize = DEFAULTS.batchSize;
      this.flushIntervalMs = DEFAULTS.flushIntervalMs;
      this.setDisabled(
        'Missing apiKey. Set GRAFANA_CLOUD_API_KEY env var or pass apiKey in config.',
      );
      return;
    }

    this.instanceId = instanceId;
    this.apiKey = apiKey;

    // Build Basic auth header
    this.authHeader = `Basic ${btoa(`${instanceId}:${apiKey}`)}`;

    // Resolve endpoints
    const zone = config.zone ?? process.env['GRAFANA_CLOUD_ZONE'] ?? DEFAULTS.zone;

    this.tempoEndpoint =
      config.tempoEndpoint ??
      process.env['GRAFANA_CLOUD_TEMPO_ENDPOINT'] ??
      `https://tempo-${zone}.grafana.net`;

    this.mimirEndpoint =
      config.mimirEndpoint ??
      process.env['GRAFANA_CLOUD_MIMIR_ENDPOINT'] ??
      `https://mimir-${zone}.grafana.net`;

    this.lokiEndpoint =
      config.lokiEndpoint ??
      process.env['GRAFANA_CLOUD_LOKI_ENDPOINT'] ??
      `https://logs-${zone}.grafana.net`;

    this.serviceName = config.serviceName ?? DEFAULTS.serviceName;
    this.batchSize = config.batchSize ?? DEFAULTS.batchSize;
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULTS.flushIntervalMs;

    // Start periodic flush timer
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    // Prevent timer from keeping the process alive
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }

    this.logger.info('GrafanaCloudExporter initialized', {
      zone,
      tempoEndpoint: this.tempoEndpoint,
      mimirEndpoint: this.mimirEndpoint,
      lokiEndpoint: this.lokiEndpoint,
    });
  }

  /**
   * Optional init hook - pick up serviceName from ObservabilityInstanceConfig if available.
   */
  override init(options: InitExporterOptions): void {
    if (options.config?.serviceName && this.serviceName === DEFAULTS.serviceName) {
      // We can't reassign readonly, so we use Object.defineProperty for this override
      Object.defineProperty(this, 'serviceName', { value: options.config.serviceName });
    }
  }

  // ============================================================================
  // Signal Handlers
  // ============================================================================

  /**
   * Handle tracing events. Only exports on SPAN_ENDED (completion pattern).
   * Buffers spans and flushes when batch size is reached.
   */
  async onTracingEvent(event: TracingEvent): Promise<void> {
    if (this.isDisabled) return;

    // Only export completed spans
    if (event.type !== TracingEventType.SPAN_ENDED) return;

    this.spanBuffer.push(event.exportedSpan);

    if (this.spanBuffer.length >= this.batchSize) {
      await this.flushSpans();
    }
  }

  /**
   * Handle log events. Buffers logs and flushes when batch size is reached.
   */
  async onLogEvent(event: LogEvent): Promise<void> {
    if (this.isDisabled) return;

    this.logBuffer.push(event.log);

    if (this.logBuffer.length >= this.batchSize) {
      await this.flushLogs();
    }
  }

  /**
   * Handle metric events. Buffers metrics and flushes when batch size is reached.
   */
  async onMetricEvent(event: MetricEvent): Promise<void> {
    if (this.isDisabled) return;

    this.metricBuffer.push(event.metric);

    if (this.metricBuffer.length >= this.batchSize) {
      await this.flushMetrics();
    }
  }

  // ============================================================================
  // BaseExporter abstract method (for backward compat tracing path)
  // ============================================================================

  /**
   * Called by BaseExporter.exportTracingEvent() for the legacy tracing path.
   * Delegates to onTracingEvent for consistent handling.
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    await this.onTracingEvent(event);
  }

  // ============================================================================
  // Flush Operations
  // ============================================================================

  /**
   * Flush all buffered data to Grafana Cloud.
   */
  override async flush(): Promise<void> {
    if (this.isDisabled) return;

    await Promise.allSettled([this.flushSpans(), this.flushMetrics(), this.flushLogs()]);
  }

  /**
   * Flush buffered spans to Tempo.
   */
  private async flushSpans(): Promise<void> {
    if (this.spanBuffer.length === 0) return;

    const spans = this.spanBuffer;
    this.spanBuffer = [];

    try {
      const body = formatSpansForTempo(spans, this.serviceName);
      await this.sendToTempo(body);
      this.logger.debug(`[GrafanaCloud] Exported ${spans.length} spans to Tempo`);
    } catch (error) {
      this.logger.error('[GrafanaCloud] Failed to export spans to Tempo', { error });
      // Re-buffer for retry on next flush (with size cap to prevent unbounded growth)
      if (this.spanBuffer.length + spans.length <= this.batchSize * 5) {
        this.spanBuffer = spans.concat(this.spanBuffer);
      }
    }
  }

  /**
   * Flush buffered metrics to Mimir.
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    const metrics = this.metricBuffer;
    this.metricBuffer = [];

    try {
      const body = formatMetricsForMimir(metrics, this.serviceName);
      await this.sendToMimir(body);
      this.logger.debug(`[GrafanaCloud] Exported ${metrics.length} metrics to Mimir`);
    } catch (error) {
      this.logger.error('[GrafanaCloud] Failed to export metrics to Mimir', { error });
      if (this.metricBuffer.length + metrics.length <= this.batchSize * 5) {
        this.metricBuffer = metrics.concat(this.metricBuffer);
      }
    }
  }

  /**
   * Flush buffered logs to Loki.
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logs = this.logBuffer;
    this.logBuffer = [];

    try {
      const body = formatLogsForLoki(logs, this.serviceName);
      await this.sendToLoki(body);
      this.logger.debug(`[GrafanaCloud] Exported ${logs.length} logs to Loki`);
    } catch (error) {
      this.logger.error('[GrafanaCloud] Failed to export logs to Loki', { error });
      if (this.logBuffer.length + logs.length <= this.batchSize * 5) {
        this.logBuffer = logs.concat(this.logBuffer);
      }
    }
  }

  // ============================================================================
  // HTTP Transport
  // ============================================================================

  /**
   * Send OTLP trace data to Grafana Tempo.
   */
  private async sendToTempo(body: unknown): Promise<void> {
    const url = `${this.tempoEndpoint}/v1/traces`;
    await this.sendRequest(url, body);
  }

  /**
   * Send OTLP metric data to Grafana Mimir.
   */
  private async sendToMimir(body: unknown): Promise<void> {
    const url = `${this.mimirEndpoint}/otlp/v1/metrics`;
    await this.sendRequest(url, body);
  }

  /**
   * Send log data to Grafana Loki.
   */
  private async sendToLoki(body: unknown): Promise<void> {
    const url = `${this.lokiEndpoint}/loki/api/v1/push`;
    await this.sendRequest(url, body);
  }

  /**
   * Send an authenticated JSON request to a Grafana Cloud endpoint.
   */
  private async sendRequest(url: string, body: unknown): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
        'X-Scope-OrgID': this.instanceId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '(no body)');
      throw new Error(
        `Grafana Cloud API error: ${response.status} ${response.statusText} - ${responseText}`,
      );
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Shutdown the exporter: flush remaining data and clean up resources.
   */
  override async shutdown(): Promise<void> {
    // Stop the periodic flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush any remaining buffered data
    await this.flush();

    await super.shutdown();
  }
}
