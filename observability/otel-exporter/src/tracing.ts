/**
 * OpenTelemetry Exporter for Mastra
 *
 * Exports traces, logs, and metrics to any OTLP-compatible endpoint.
 */

import type {
  TracingEvent,
  LogEvent,
  MetricEvent,
  InitExporterOptions,
  ObservabilityInstanceConfig,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';

import type { ExportResult } from '@opentelemetry/core';
import { ExportResultCode } from '@opentelemetry/core';

import { resourceFromAttributes } from '@opentelemetry/resources';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

import { loadExporter, loadSignalExporter } from './loadExporter.js';
import { convertLog } from './log-converter.js';
import { MetricInstrumentCache } from './metric-converter.js';
import { resolveProviderConfig } from './provider-configs.js';
import type { ResolvedProviderConfig } from './provider-configs.js';
import { SpanConverter } from './span-converter.js';
import type { ExportProtocol, OtelExporterConfig } from './types.js';

/**
 * Wrapper around a SpanExporter that logs export results when debug mode is enabled.
 * The OTel SDK intentionally does not log on success, making debugging difficult.
 * This wrapper adds visibility into each batch export's outcome.
 */
class DebugSpanExporterWrapper implements SpanExporter {
  constructor(
    private inner: SpanExporter,
    private debugLog: (msg: string) => void,
  ) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const count = spans.length;
    this.inner.export(spans, (result: ExportResult) => {
      if (result.code === ExportResultCode.SUCCESS) {
        this.debugLog(`[OtelExporter] Export completed: ${count} spans sent successfully`);
      } else {
        this.debugLog(`[OtelExporter] Export FAILED: ${count} spans, error: ${result.error?.message ?? 'unknown'}`);
      }
      resultCallback(result);
    });
  }

  async shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this.inner.forceFlush?.();
  }
}

/**
 * Wrapper around a LogRecordExporter that logs export results when debug mode is enabled.
 * Same pattern as DebugSpanExporterWrapper but for log records.
 */
class DebugLogExporterWrapper {
  constructor(
    private inner: any,
    private debugLog: (msg: string) => void,
  ) {}

  export(logs: any[], resultCallback: (result: ExportResult) => void): void {
    const count = logs.length;
    this.inner.export(logs, (result: ExportResult) => {
      if (result.code === ExportResultCode.SUCCESS) {
        this.debugLog(`[OtelExporter] Log export completed: ${count} logs sent successfully`);
      } else {
        this.debugLog(`[OtelExporter] Log export FAILED: ${count} logs, error: ${result.error?.message ?? 'unknown'}`);
      }
      resultCallback(result);
    });
  }

  async shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this.inner.forceFlush?.();
  }
}

/**
 * Wrapper around a PushMetricExporter that logs export results when debug mode is enabled.
 * Same pattern as DebugSpanExporterWrapper but for metrics.
 */
class DebugMetricExporterWrapper {
  constructor(
    private inner: any,
    private debugLog: (msg: string) => void,
  ) {}

  export(metrics: any, resultCallback: (result: ExportResult) => void): void {
    this.inner.export(metrics, (result: ExportResult) => {
      const scopeCount = metrics?.scopeMetrics?.length ?? 0;
      if (result.code === ExportResultCode.SUCCESS) {
        this.debugLog(`[OtelExporter] Metric export completed: ${scopeCount} scope(s) sent successfully`);
      } else {
        this.debugLog(
          `[OtelExporter] Metric export FAILED: ${scopeCount} scope(s), error: ${result.error?.message ?? 'unknown'}`,
        );
      }
      resultCallback(result);
    });
  }

  selectAggregationTemporality(instrumentType: any): any {
    return this.inner.selectAggregationTemporality?.(instrumentType);
  }

  selectAggregation(instrumentType: any): any {
    return this.inner.selectAggregation?.(instrumentType);
  }

  async shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  async forceFlush(): Promise<void> {
    return this.inner.forceFlush?.();
  }
}

export class OtelExporter extends BaseExporter {
  private config: OtelExporterConfig;
  private observabilityConfig?: ObservabilityInstanceConfig;

  // Trace signal
  private spanConverter?: SpanConverter;
  private processor?: BatchSpanProcessor;
  private exporter?: SpanExporter;

  // Log signal
  private loggerProvider?: LoggerProvider;
  private otelLogger?: Logger;

  // Metric signal
  private meterProvider?: MeterProvider;
  private metricCache?: MetricInstrumentCache;

  // Provider config (resolved once, shared across signals)
  private resolvedConfig?: ResolvedProviderConfig | null;
  private providerName?: string;

  // Single setup promise — all signals initialize together at init() time.
  // Event handlers await this before processing. Never rejects.
  private setupPromise?: Promise<void>;

  name = 'opentelemetry';

  constructor(config: OtelExporterConfig) {
    super(config);

    this.config = config;

    // Set OTel SDK diagnostics to INFO level so we see warnings/errors from
    // the SDK internals. We intentionally do NOT use DEBUG here because:
    // 1. OTLPExportDelegate dumps enormous payloads at DEBUG level
    // 2. diag.setLogger() is global and can be overwritten by other code
    // Our DebugSpanExporterWrapper provides export-result logging instead.
    if (config.logLevel === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
    }
  }

  /**
   * Initialize with observability configuration and eagerly set up all signal
   * exporters (traces, logs, metrics) in parallel.
   *
   * Called by Mastra during component registration. The async setup runs in the
   * background — event handlers await the resulting promise before processing.
   */
  init(options: InitExporterOptions) {
    this.observabilityConfig = options.config;
    this.setupPromise = this.setupAllSignals();
  }

  // ===========================================================================
  // Provider config resolution (shared across all signals)
  // ===========================================================================

  private get isDebug(): boolean {
    return this.config.logLevel === 'debug';
  }

  /**
   * Debug logging that bypasses the Mastra logger.
   *
   * The Mastra framework replaces our logger via __setLogger() with one at
   * INFO level, which silently swallows all this.logger.debug() calls.
   * For debug output we need to go through console.info directly.
   */

  private debugLog = (...args: unknown[]) => this.isDebug && console.info('[OtelExporter:debug]', ...args);

  private resolveProvider(): ResolvedProviderConfig | null {
    if (this.resolvedConfig !== undefined) {
      return this.resolvedConfig;
    }

    if (!this.config.provider) {
      this.setDisabled(
        '[OtelExporter] Provider configuration is required. Use the "custom" provider for generic endpoints.',
      );
      this.resolvedConfig = null;
      return null;
    }

    this.providerName = Object.keys(this.config.provider)[0];
    const resolved = resolveProviderConfig(this.config.provider, this.isDebug);
    if (!resolved) {
      this.setDisabled('[OtelExporter] Provider configuration validation failed.');
      this.resolvedConfig = null;
      return null;
    }

    this.resolvedConfig = resolved;
    return resolved;
  }

  /**
   * Derive the endpoint for a specific signal from the resolved provider config.
   * Provider configs typically resolve with /v1/traces in the endpoint.
   * For logs and metrics we need /v1/logs and /v1/metrics respectively.
   */
  private getSignalEndpoint(resolved: ResolvedProviderConfig, signal: 'traces' | 'logs' | 'metrics'): string {
    const endpoint = resolved.endpoint;
    const signalPaths: Record<string, string> = {
      traces: '/v1/traces',
      logs: '/v1/logs',
      metrics: '/v1/metrics',
    };

    // Replace any existing signal path suffix
    for (const path of Object.values(signalPaths)) {
      if (endpoint.endsWith(path)) {
        return endpoint.slice(0, -path.length) + signalPaths[signal];
      }
    }

    // No recognized signal path — append the signal path
    return endpoint + signalPaths[signal];
  }

  /**
   * Build exporter constructor options for the given signal endpoint.
   * For gRPC, converts headers to Metadata. For HTTP protocols, passes headers directly.
   */
  private async buildExporterOptions(
    protocol: ExportProtocol,
    url: string,
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    if (protocol === 'grpc') {
      const grpcModule = await import('@grpc/grpc-js');
      const metadata = new grpcModule.Metadata();
      for (const [key, value] of Object.entries(headers)) {
        metadata.set(key, value);
      }
      return { url, metadata, timeoutMillis: this.config.timeout };
    }
    return { url, headers, timeoutMillis: this.config.timeout };
  }

  // ===========================================================================
  // Setup — eager, parallel initialization of all signals
  // ===========================================================================

  /**
   * Wait for setup to complete. If init() was called, this awaits the
   * already-in-flight setup promise. If init() was never called (standalone
   * usage without Mastra), this triggers setup on first use.
   */
  private ensureSetup(): Promise<void> {
    if (!this.setupPromise) {
      this.setupPromise = this.setupAllSignals();
    }
    return this.setupPromise;
  }

  /**
   * Resolve provider config once and set up all enabled signals in parallel.
   * Each signal setup catches its own errors — this method never rejects.
   */
  private async setupAllSignals(): Promise<void> {
    const resolved = this.resolveProvider();
    if (!resolved) {
      this.debugLog('Setup skipped: provider not resolved');
      return;
    }

    const protocol = resolved.protocol;
    const setupTasks: Promise<void>[] = [];

    if (this.config.signals?.traces !== false) {
      setupTasks.push(this.setupTraces(resolved, protocol));
    } else {
      this.debugLog('Trace export disabled via config');
    }

    if (this.config.signals?.logs !== false) {
      setupTasks.push(this.setupLogs(resolved, protocol));
    } else {
      this.debugLog('Log export disabled via config');
    }

    if (this.config.signals?.metrics !== false) {
      setupTasks.push(this.setupMetrics(resolved, protocol));
    } else {
      this.debugLog('Metric export disabled via config');
    }

    await Promise.all(setupTasks);

    this.debugLog(
      `Setup complete [traces=${!!this.processor}, logs=${!!this.otelLogger}, metrics=${!!this.metricCache}]`,
    );
  }

  // ---------------------------------------------------------------------------
  // Trace setup
  // ---------------------------------------------------------------------------

  private async setupTraces(resolved: ResolvedProviderConfig, protocol: ExportProtocol): Promise<void> {
    try {
      // Create or use the provided SpanExporter
      if (this.config.exporter) {
        this.exporter = this.config.exporter;
      } else {
        const endpoint = resolved.endpoint;
        const headers = resolved.headers;

        this.debugLog(`Setting up trace exporter: protocol=${protocol}, endpoint=${endpoint}`);

        const ExporterClass = await loadExporter(protocol, this.providerName);
        if (!ExporterClass) {
          this.debugLog(`Trace exporter not available for protocol: ${protocol}`);
          return;
        }

        const exporterOptions =
          protocol === 'zipkin'
            ? { url: endpoint, headers }
            : await this.buildExporterOptions(protocol, endpoint, headers);
        this.exporter = new ExporterClass(exporterOptions);

        this.debugLog(`Trace exporter created: ${this.exporter?.constructor?.name ?? 'unknown'} -> ${endpoint}`);
      }

      // Create processor
      const serviceName = this.observabilityConfig?.serviceName || 'mastra-service';

      this.spanConverter = new SpanConverter({
        packageName: '@mastra/otel-exporter',
        serviceName,
        config: this.config,
        format: 'GenAI_v1_38_0',
      });

      const exporterForProcessor = this.isDebug
        ? new DebugSpanExporterWrapper(this.exporter!, msg => this.debugLog(msg))
        : this.exporter!;

      this.processor = new BatchSpanProcessor(exporterForProcessor, {
        maxExportBatchSize: this.config.batchSize || 512,
        maxQueueSize: 2048,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: this.config.timeout || 30000,
      });

      this.debugLog(
        `Trace export initialized (service.name: "${serviceName}", batch size: ${this.config.batchSize || 512}, delay: 5s)`,
      );
    } catch (error) {
      this.logger.warn('[OtelExporter] Failed to initialize trace export');
      this.debugLog('Trace setup error:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Log setup
  // ---------------------------------------------------------------------------

  private async setupLogs(resolved: ResolvedProviderConfig, protocol: ExportProtocol): Promise<void> {
    try {
      const LogExporterClass = await loadSignalExporter('logs', protocol, this.providerName);
      if (!LogExporterClass) {
        this.debugLog(`Log exporter package not available for protocol "${protocol}". Log export disabled.`);
        return;
      }

      const logEndpoint = this.getSignalEndpoint(resolved, 'logs');
      const headers = resolved.headers;

      this.debugLog(`Setting up log exporter: protocol=${protocol}, endpoint=${logEndpoint}`);

      const logExporterOptions = await this.buildExporterOptions(protocol, logEndpoint, headers);
      const logExporter = new LogExporterClass(logExporterOptions);

      const exporterForProcessor = this.isDebug
        ? new DebugLogExporterWrapper(logExporter, msg => this.debugLog(msg))
        : logExporter;

      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.observabilityConfig?.serviceName || 'mastra-service',
      });

      this.loggerProvider = new LoggerProvider({
        resource,
        processors: [
          new BatchLogRecordProcessor(exporterForProcessor, {
            maxExportBatchSize: this.config.batchSize || 512,
            maxQueueSize: 2048,
            scheduledDelayMillis: 5000,
            exportTimeoutMillis: this.config.timeout || 30000,
          }),
        ],
      });

      this.otelLogger = this.loggerProvider.getLogger('@mastra/otel-exporter');

      this.debugLog(`Log export initialized (endpoint: ${logEndpoint})`);
    } catch (error) {
      this.logger.warn('[OtelExporter] Failed to initialize log export');
      this.debugLog('Log setup error:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Metric setup
  // ---------------------------------------------------------------------------

  private async setupMetrics(resolved: ResolvedProviderConfig, protocol: ExportProtocol): Promise<void> {
    try {
      const MetricExporterClass = await loadSignalExporter('metrics', protocol, this.providerName);
      if (!MetricExporterClass) {
        this.debugLog(`Metric exporter package not available for protocol "${protocol}". Metric export disabled.`);
        return;
      }

      const metricEndpoint = this.getSignalEndpoint(resolved, 'metrics');
      const headers = resolved.headers;

      this.debugLog(`Setting up metric exporter: protocol=${protocol}, endpoint=${metricEndpoint}`);

      const metricExporterOptions = await this.buildExporterOptions(protocol, metricEndpoint, headers);
      const metricExporter = new MetricExporterClass(metricExporterOptions);

      const exporterForReader = this.isDebug
        ? new DebugMetricExporterWrapper(metricExporter, msg => this.debugLog(msg))
        : metricExporter;

      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.observabilityConfig?.serviceName || 'mastra-service',
      });

      const exportTimeoutMillis = this.config.timeout || 30000;
      // OTel SDK requires exportIntervalMillis >= exportTimeoutMillis
      const exportIntervalMillis = Math.max(60000, exportTimeoutMillis);

      this.meterProvider = new MeterProvider({
        resource,
        readers: [
          new PeriodicExportingMetricReader({
            exporter: exporterForReader,
            exportIntervalMillis,
            exportTimeoutMillis,
          }),
        ],
      });

      const meter = this.meterProvider.getMeter('@mastra/otel-exporter');
      this.metricCache = new MetricInstrumentCache(meter);

      this.debugLog(`Metric export initialized (endpoint: ${metricEndpoint})`);
    } catch (error) {
      this.logger.warn('[OtelExporter] Failed to initialize metric export');
      this.debugLog('Metric setup error:', error);
    }
  }

  // ===========================================================================
  // Trace event handler
  // ===========================================================================

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (this.config.signals?.traces === false) return;
    if (event.type !== TracingEventType.SPAN_ENDED) return;

    await this.ensureSetup();

    if (this.isDisabled || !this.processor) return;

    const span = event.exportedSpan;

    try {
      const otelSpan = await this.spanConverter!.convertSpan(span);
      this.processor.onEnd(otelSpan);

      this.debugLog(
        `Queued span ${span.id} (trace: ${span.traceId}, parent: ${span.parentSpanId || 'none'}, type: ${span.type})`,
      );
    } catch (error) {
      this.logger.error(`[OtelExporter] Failed to export span ${span.id}:`, error);
    }
  }

  // ===========================================================================
  // Log event handler
  // ===========================================================================

  async onLogEvent(event: LogEvent): Promise<void> {
    this.debugLog(`onLogEvent received (level: ${event.log.level}, message: "${event.log.message}")`);

    await this.ensureSetup();

    if (this.isDisabled) {
      this.debugLog('Log event skipped: exporter is disabled');
      return;
    }

    if (!this.otelLogger) {
      this.debugLog('Log event skipped: log exporter not available');
      return;
    }

    try {
      const logParams = convertLog(event.log);

      // Add trace context as attributes if available
      const attributes = { ...logParams.attributes };
      if (logParams.traceId) {
        attributes['mastra.traceId'] = logParams.traceId;
      }
      if (logParams.spanId) {
        attributes['mastra.spanId'] = logParams.spanId;
      }

      this.otelLogger.emit({
        timestamp: logParams.timestamp,
        severityNumber: logParams.severityNumber,
        severityText: logParams.severityText,
        body: logParams.body,
        attributes,
      });

      this.debugLog(`Exported log (level: ${event.log.level}, trace: ${event.log.traceId || 'none'})`);
    } catch (error) {
      this.logger.error('[OtelExporter] Failed to export log:', error);
    }
  }

  // ===========================================================================
  // Metric event handler
  // ===========================================================================

  async onMetricEvent(event: MetricEvent): Promise<void> {
    this.debugLog(`onMetricEvent received (name: ${event.metric.name}, type: ${event.metric.metricType})`);

    await this.ensureSetup();

    if (this.isDisabled) {
      this.debugLog('Metric event skipped: exporter is disabled');
      return;
    }

    if (!this.metricCache) {
      this.debugLog('Metric event skipped: metric exporter not available');
      return;
    }

    try {
      this.metricCache.recordMetric(event.metric);

      this.debugLog(
        `Recorded metric ${event.metric.name} (type: ${event.metric.metricType}, value: ${event.metric.value})`,
      );
    } catch (error) {
      this.logger.error(`[OtelExporter] Failed to record metric ${event.metric.name}:`, error);
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Force flush any buffered data without shutting down the exporter.
   * Delegates to all active processors/providers.
   */
  async flush(): Promise<void> {
    const flushPromises: Promise<void>[] = [];
    const signals: string[] = [];

    if (this.processor) {
      flushPromises.push(this.processor.forceFlush());
      signals.push('traces');
    }
    if (this.loggerProvider) {
      flushPromises.push(this.loggerProvider.forceFlush());
      signals.push('logs');
    }
    if (this.meterProvider) {
      flushPromises.push(this.meterProvider.forceFlush());
      signals.push('metrics');
    }

    if (flushPromises.length > 0) {
      this.debugLog(`Flushing signals: ${signals.join(', ')}...`);
      await Promise.all(flushPromises);
      this.debugLog('Flushed all pending data');
    } else {
      this.debugLog('Flush called but no active exporters');
    }
  }

  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    if (this.processor) {
      shutdownPromises.push(this.processor.shutdown());
    }
    if (this.loggerProvider) {
      shutdownPromises.push(this.loggerProvider.shutdown());
    }
    if (this.meterProvider) {
      shutdownPromises.push(this.meterProvider.shutdown());
    }

    if (shutdownPromises.length > 0) {
      await Promise.all(shutdownPromises);
    }
  }
}
