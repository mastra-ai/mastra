/**
 * GrafanaExporter - exports traces, metrics, and logs to the Grafana stack.
 *
 * Supports both Grafana Cloud and self-hosted deployments:
 * - Traces → Grafana Tempo (via OTLP/HTTP JSON)
 * - Metrics → Grafana Mimir (via OTLP/HTTP JSON)
 * - Logs → Grafana Loki (via JSON push API)
 *
 * Use the `grafanaCloud()` or `grafana()` config helpers for easy setup.
 *
 * Supports batching with configurable batch size and flush interval.
 * In serverless environments, call `flush()` before function termination.
 */

import { TracingEventType } from '@mastra/core/observability';
import type {
  AnyExportedSpan,
  TracingEvent,
  InitExporterOptions,
} from '@mastra/core/observability';
import type { ExportedLog, LogEvent } from '@mastra/core/observability';
import type { ExportedMetric, MetricEvent } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';

import { formatLogsForLoki } from './formatters/logs.js';
import { formatMetricsForMimir } from './formatters/metrics.js';
import { formatSpansForTempo } from './formatters/traces.js';
import type { GrafanaAuth, GrafanaExporterConfig } from './types.js';
import { DEFAULTS } from './types.js';

/**
 * Known API path suffixes for each backend.
 * Used to detect if the user already included the path in their endpoint URL.
 */
const TEMPO_PATH = '/v1/traces';
const MIMIR_PATH = '/v1/metrics';
const LOKI_PATH = '/loki/api/v1/push';

/**
 * Normalize an endpoint URL:
 * - Strip trailing slashes
 * - Ensure https:// prefix if no protocol is present
 */
function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

/**
 * Build the full URL for a backend, avoiding double-pathing.
 * If the endpoint already ends with the expected path suffix, use it as-is.
 */
function buildUrl(endpoint: string, pathSuffix: string): string {
  if (endpoint.endsWith(pathSuffix)) {
    return endpoint;
  }
  return `${endpoint}${pathSuffix}`;
}

/**
 * Build HTTP headers from GrafanaAuth configuration.
 */
function buildAuthHeaders(auth: GrafanaAuth): Record<string, string> {
  switch (auth.type) {
    case 'basic':
      return { Authorization: `Basic ${btoa(`${auth.username}:${auth.password}`)}` };
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` };
    case 'custom':
      return { ...auth.headers };
    case 'none':
      return {};
  }
}

/**
 * GrafanaExporter sends telemetry to the Grafana observability stack
 * (Tempo, Mimir, Loki) — either Grafana Cloud or self-hosted.
 *
 * Implements `onTracingEvent`, `onLogEvent`, and `onMetricEvent` handlers,
 * indicating support for all three signals (T/M/L).
 *
 * @example Grafana Cloud
 * ```typescript
 * import { GrafanaExporter, grafanaCloud } from '@mastra/grafana';
 *
 * const exporter = new GrafanaExporter(grafanaCloud({
 *   instanceId: process.env.GRAFANA_CLOUD_INSTANCE_ID,
 *   apiKey: process.env.GRAFANA_CLOUD_API_KEY,
 * }));
 * ```
 *
 * @example Self-hosted
 * ```typescript
 * import { GrafanaExporter, grafana } from '@mastra/grafana';
 *
 * const exporter = new GrafanaExporter(grafana({
 *   tempoEndpoint: 'http://localhost:4318',
 *   mimirEndpoint: 'http://localhost:9090',
 *   lokiEndpoint: 'http://localhost:3100',
 * }));
 * ```
 */
export class GrafanaExporter extends BaseExporter {
  readonly name = 'grafana';

  private readonly tempoEndpoint: string;
  private readonly mimirEndpoint: string;
  private readonly lokiEndpoint: string;
  private serviceName: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;

  // Per-service tenant IDs (for X-Scope-OrgID header)
  private readonly tempoTenantId?: string;
  private readonly mimirTenantId?: string;
  private readonly lokiTenantId?: string;

  // Batching buffers
  private spanBuffer: AnyExportedSpan[] = [];
  private metricBuffer: ExportedMetric[] = [];
  private logBuffer: ExportedLog[] = [];

  // Flush timer
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  // Per-service auth headers (cached)
  private readonly tempoAuthHeaders: Record<string, string>;
  private readonly mimirAuthHeaders: Record<string, string>;
  private readonly lokiAuthHeaders: Record<string, string>;

  constructor(config: GrafanaExporterConfig = {}) {
    super(config);

    // Resolve endpoints from config or env vars
    const tempoEndpoint =
      config.tempoEndpoint ?? process.env['GRAFANA_TEMPO_ENDPOINT'];
    const mimirEndpoint =
      config.mimirEndpoint ?? process.env['GRAFANA_MIMIR_ENDPOINT'];
    const lokiEndpoint =
      config.lokiEndpoint ?? process.env['GRAFANA_LOKI_ENDPOINT'];

    // At least one endpoint must be configured
    if (!tempoEndpoint && !mimirEndpoint && !lokiEndpoint) {
      this.tempoEndpoint = '';
      this.mimirEndpoint = '';
      this.lokiEndpoint = '';
      this.tempoAuthHeaders = {};
      this.mimirAuthHeaders = {};
      this.lokiAuthHeaders = {};
      this.serviceName = DEFAULTS.serviceName;
      this.batchSize = DEFAULTS.batchSize;
      this.flushIntervalMs = DEFAULTS.flushIntervalMs;
      this.setDisabled(
        'No endpoints configured. Provide tempoEndpoint, mimirEndpoint, or lokiEndpoint, ' +
          'or use the grafanaCloud() / grafana() config helpers.',
      );
      return;
    }

    this.tempoEndpoint = tempoEndpoint ? normalizeEndpoint(tempoEndpoint) : '';
    this.mimirEndpoint = mimirEndpoint ? normalizeEndpoint(mimirEndpoint) : '';
    this.lokiEndpoint = lokiEndpoint ? normalizeEndpoint(lokiEndpoint) : '';

    // Resolve per-service tenant IDs, falling back to the shared tenantId
    this.tempoTenantId = config.tempoTenantId ?? config.tenantId;
    this.mimirTenantId = config.mimirTenantId ?? config.tenantId;
    this.lokiTenantId = config.lokiTenantId ?? config.tenantId;

    // Build per-service auth headers, falling back to the shared auth
    const defaultAuthHeaders = config.auth ? buildAuthHeaders(config.auth) : {};
    this.tempoAuthHeaders = config.tempoAuth ? buildAuthHeaders(config.tempoAuth) : defaultAuthHeaders;
    this.mimirAuthHeaders = config.mimirAuth ? buildAuthHeaders(config.mimirAuth) : defaultAuthHeaders;
    this.lokiAuthHeaders = config.lokiAuth ? buildAuthHeaders(config.lokiAuth) : defaultAuthHeaders;

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

    this.logger.info('GrafanaExporter initialized', {
      tempoEndpoint: this.tempoEndpoint || '(disabled)',
      mimirEndpoint: this.mimirEndpoint || '(disabled)',
      lokiEndpoint: this.lokiEndpoint || '(disabled)',
      authType: config.auth?.type ?? 'none',
    });
  }

  /**
   * Optional init hook - pick up serviceName from ObservabilityInstanceConfig if available.
   */
  override init(options: InitExporterOptions): void {
    if (options.config?.serviceName && this.serviceName === DEFAULTS.serviceName) {
      this.serviceName = options.config.serviceName;
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
    if (this.isDisabled || !this.tempoEndpoint) return;

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
    if (this.isDisabled || !this.lokiEndpoint) return;

    this.logBuffer.push(event.log);

    if (this.logBuffer.length >= this.batchSize) {
      await this.flushLogs();
    }
  }

  /**
   * Handle metric events. Buffers metrics and flushes when batch size is reached.
   */
  async onMetricEvent(event: MetricEvent): Promise<void> {
    if (this.isDisabled || !this.mimirEndpoint) return;

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
   * Flush all buffered data to Grafana.
   */
  override async flush(): Promise<void> {
    if (this.isDisabled) return;

    await Promise.allSettled([this.flushSpans(), this.flushMetrics(), this.flushLogs()]);
  }

  /**
   * Flush buffered spans to Tempo.
   */
  private async flushSpans(): Promise<void> {
    if (this.spanBuffer.length === 0 || !this.tempoEndpoint) return;

    const spans = this.spanBuffer;
    this.spanBuffer = [];

    try {
      const body = formatSpansForTempo(spans, this.serviceName);
      await this.sendToTempo(body);
      this.logger.debug(`[Grafana] Exported ${spans.length} spans to Tempo`);
    } catch (error) {
      this.logger.error('[Grafana] Failed to export spans to Tempo', { error });
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
    if (this.metricBuffer.length === 0 || !this.mimirEndpoint) return;

    const metrics = this.metricBuffer;
    this.metricBuffer = [];

    try {
      const body = formatMetricsForMimir(metrics, this.serviceName);
      await this.sendToMimir(body);
      this.logger.debug(`[Grafana] Exported ${metrics.length} metrics to Mimir`);
    } catch (error) {
      this.logger.error('[Grafana] Failed to export metrics to Mimir', { error });
      if (this.metricBuffer.length + metrics.length <= this.batchSize * 5) {
        this.metricBuffer = metrics.concat(this.metricBuffer);
      }
    }
  }

  /**
   * Flush buffered logs to Loki.
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.lokiEndpoint) return;

    const logs = this.logBuffer;
    this.logBuffer = [];

    try {
      const body = formatLogsForLoki(logs, this.serviceName);
      await this.sendToLoki(body);
      this.logger.debug(`[Grafana] Exported ${logs.length} logs to Loki`);
    } catch (error) {
      this.logger.error('[Grafana] Failed to export logs to Loki', { error });
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
    const url = buildUrl(this.tempoEndpoint, TEMPO_PATH);
    await this.sendRequest(url, body, this.tempoAuthHeaders, this.tempoTenantId);
  }

  /**
   * Send OTLP metric data to Grafana Mimir.
   */
  private async sendToMimir(body: unknown): Promise<void> {
    const url = buildUrl(this.mimirEndpoint, MIMIR_PATH);
    await this.sendRequest(url, body, this.mimirAuthHeaders, this.mimirTenantId);
  }

  /**
   * Send log data to Grafana Loki.
   */
  private async sendToLoki(body: unknown): Promise<void> {
    const url = buildUrl(this.lokiEndpoint, LOKI_PATH);
    await this.sendRequest(url, body, this.lokiAuthHeaders, this.lokiTenantId);
  }

  /**
   * Send an authenticated JSON request to a Grafana endpoint.
   */
  private async sendRequest(
    url: string,
    body: unknown,
    authHeaders: Record<string, string>,
    tenantId?: string,
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
    };

    if (tenantId) {
      headers['X-Scope-OrgID'] = tenantId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '(no body)');
      throw new Error(
        `Grafana API error: ${response.status} ${response.statusText} - ${responseText}`,
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
