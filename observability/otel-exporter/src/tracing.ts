/**
 * OpenTelemetry Exporter for Mastra
 *
 * Exports traces, logs, and metrics to any OTLP-compatible endpoint.
 */

import type {
  TracingEvent,
  LogEvent,
  MetricEvent,
  AnyExportedSpan,
  InitExporterOptions,
  ObservabilityInstanceConfig,
} from '@mastra/core/observability';
import { TracingEventType } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

import { loadExporter, loadSignalExporter } from './loadExporter.js';
import { convertLog } from './log-converter.js';
import { MetricInstrumentCache } from './metric-converter.js';
import { resolveProviderConfig } from './provider-configs.js';
import type { ResolvedProviderConfig } from './provider-configs.js';
import { SpanConverter } from './span-converter.js';
import type { OtelExporterConfig } from './types.js';

export class OtelExporter extends BaseExporter {
  private config: OtelExporterConfig;
  private observabilityConfig?: ObservabilityInstanceConfig;
  private spanConverter?: SpanConverter;
  private processor?: BatchSpanProcessor;
  private exporter?: SpanExporter;
  private isSetup: boolean = false;

  // Log support
  private loggerProvider?: any; // LoggerProvider from @opentelemetry/sdk-logs
  private otelLogger?: any; // Logger from @opentelemetry/api-logs
  private isLogSetup: boolean = false;
  private logSetupFailed: boolean = false;

  // Metric support
  private meterProvider?: any; // MeterProvider from @opentelemetry/sdk-metrics
  private metricCache?: MetricInstrumentCache;
  private isMetricSetup: boolean = false;
  private metricSetupFailed: boolean = false;

  // Resolved provider config (shared across signals)
  private resolvedConfig?: ResolvedProviderConfig | null;
  private providerName?: string;

  name = 'opentelemetry';

  constructor(config: OtelExporterConfig) {
    super(config);

    this.config = config;

    // Set up OpenTelemetry diagnostics if debug mode
    if (config.logLevel === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }
  }

  /**
   * Initialize with tracing configuration
   */
  init(options: InitExporterOptions) {
    this.observabilityConfig = options.config;
  }

  // ===========================================================================
  // Provider config resolution (shared across all signals)
  // ===========================================================================

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
    const resolved = resolveProviderConfig(this.config.provider);
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

  // ===========================================================================
  // Trace setup (existing)
  // ===========================================================================

  private async setupExporter() {
    // already setup or exporter already set
    if (this.isSetup || this.exporter) return;

    const resolved = this.resolveProvider();
    if (!resolved) {
      this.isSetup = true;
      return;
    }

    // user provided an instantiated SpanExporter, use it
    if (this.config.exporter) {
      this.exporter = this.config.exporter;
      return;
    }

    const endpoint = resolved.endpoint;
    const headers = resolved.headers;
    const protocol = resolved.protocol;

    // Load and create the appropriate exporter based on protocol
    const ExporterClass = await loadExporter(protocol, this.providerName);

    if (!ExporterClass) {
      // Exporter not available, disable tracing
      this.setDisabled(`[OtelExporter] Exporter not available for protocol: ${protocol}`);
      this.isSetup = true;
      return;
    }

    try {
      if (protocol === 'zipkin') {
        this.exporter = new ExporterClass({
          url: endpoint,
          headers,
        });
      } else if (protocol === 'grpc') {
        // gRPC uses Metadata object instead of headers
        // Dynamically import @grpc/grpc-js to create metadata
        let metadata: any;
        try {
          const grpcModule = await import('@grpc/grpc-js');
          metadata = new grpcModule.Metadata();
          Object.entries(headers).forEach(([key, value]) => {
            metadata.set(key, value);
          });
        } catch (grpcError) {
          this.setDisabled(
            `[OtelExporter] Failed to load gRPC metadata. Install required packages:\n` +
              `  npm install @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js`,
          );
          this.logger.error('[OtelExporter] gRPC error details:', grpcError);
          this.isSetup = true;
          return;
        }

        this.exporter = new ExporterClass({
          url: endpoint,
          metadata,
          timeoutMillis: this.config.timeout,
        });
      } else {
        // HTTP/JSON and HTTP/Protobuf use headers
        this.exporter = new ExporterClass({
          url: endpoint,
          headers,
          timeoutMillis: this.config.timeout,
        });
      }
    } catch (error) {
      this.setDisabled('[OtelExporter] Failed to create exporter.');
      this.logger.error('[OtelExporter] Exporter creation error details:', error);
      this.isSetup = true;
      return;
    }
  }

  private async setupProcessor() {
    if (this.processor || this.isSetup) return;

    this.spanConverter = new SpanConverter({
      packageName: '@mastra/otel-exporter',
      serviceName: this.observabilityConfig?.serviceName,
      config: this.config,
      format: 'GenAI_v1_38_0',
    });

    // Always use BatchSpanProcessor for production
    // It queues spans and exports them in batches for better performance
    this.processor = new BatchSpanProcessor(this.exporter!, {
      maxExportBatchSize: this.config.batchSize || 512, // Default batch size
      maxQueueSize: 2048, // Maximum spans to queue
      scheduledDelayMillis: 5000, // Export every 5 seconds
      exportTimeoutMillis: this.config.timeout || 30000, // Export timeout
    });

    this.logger.debug(
      `[OtelExporter] Using BatchSpanProcessor (batch size: ${this.config.batchSize || 512}, delay: 5s)`,
    );
  }

  private async setup() {
    if (this.isSetup) return;
    await this.setupExporter();
    await this.setupProcessor();
    this.isSetup = true;
  }

  // ===========================================================================
  // Log setup
  // ===========================================================================

  private async setupLogExporter(): Promise<boolean> {
    if (this.isLogSetup) return !this.logSetupFailed;
    if (this.logSetupFailed) return false;

    // Check if logs are explicitly disabled
    if (this.config.signals?.logs === false) {
      this.logger.debug('[OtelExporter] Log export disabled via config');
      this.isLogSetup = true;
      this.logSetupFailed = true;
      return false;
    }

    const resolved = this.resolveProvider();
    if (!resolved) {
      this.isLogSetup = true;
      this.logSetupFailed = true;
      return false;
    }

    const protocol = resolved.protocol;
    const LogExporterClass = await loadSignalExporter('logs', protocol, this.providerName);
    if (!LogExporterClass) {
      this.logger.debug('[OtelExporter] Log exporter packages not available. Log export disabled.');
      this.isLogSetup = true;
      this.logSetupFailed = true;
      return false;
    }

    try {
      // Dynamically import the SDK packages
      const sdkLogs = await import('@opentelemetry/sdk-logs');
      const { resourceFromAttributes } = await import('@opentelemetry/resources');
      const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');

      const logEndpoint = this.getSignalEndpoint(resolved, 'logs');
      const headers = resolved.headers;

      // Create the log exporter
      let logExporter: any;
      if (protocol === 'grpc') {
        try {
          const grpcModule = await import('@grpc/grpc-js');
          const metadata = new grpcModule.Metadata();
          Object.entries(headers).forEach(([key, value]) => {
            metadata.set(key, value);
          });
          logExporter = new LogExporterClass({ url: logEndpoint, metadata });
        } catch {
          this.logger.warn('[OtelExporter] Failed to create gRPC log exporter. Log export disabled.');
          this.isLogSetup = true;
          this.logSetupFailed = true;
          return false;
        }
      } else {
        logExporter = new LogExporterClass({
          url: logEndpoint,
          headers,
        });
      }

      // Create LoggerProvider with BatchLogRecordProcessor
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.observabilityConfig?.serviceName || 'mastra-service',
      });

      this.loggerProvider = new sdkLogs.LoggerProvider({
        resource,
        processors: [
          new sdkLogs.BatchLogRecordProcessor(logExporter, {
            maxExportBatchSize: this.config.batchSize || 512,
            maxQueueSize: 2048,
            scheduledDelayMillis: 5000,
            exportTimeoutMillis: this.config.timeout || 30000,
          }),
        ],
      });

      this.otelLogger = this.loggerProvider.getLogger('@mastra/otel-exporter');

      this.logger.debug(`[OtelExporter] Log export initialized (endpoint: ${logEndpoint})`);
      this.isLogSetup = true;
      return true;
    } catch (error) {
      this.logger.warn(
        '[OtelExporter] Failed to initialize log export. Required packages: @opentelemetry/sdk-logs @opentelemetry/api-logs',
      );
      this.logger.debug('[OtelExporter] Log setup error:', error);
      this.isLogSetup = true;
      this.logSetupFailed = true;
      return false;
    }
  }

  // ===========================================================================
  // Metric setup
  // ===========================================================================

  private async setupMetricExporter(): Promise<boolean> {
    if (this.isMetricSetup) return !this.metricSetupFailed;
    if (this.metricSetupFailed) return false;

    // Check if metrics are explicitly disabled
    if (this.config.signals?.metrics === false) {
      this.logger.debug('[OtelExporter] Metric export disabled via config');
      this.isMetricSetup = true;
      this.metricSetupFailed = true;
      return false;
    }

    const resolved = this.resolveProvider();
    if (!resolved) {
      this.isMetricSetup = true;
      this.metricSetupFailed = true;
      return false;
    }

    const protocol = resolved.protocol;
    const MetricExporterClass = await loadSignalExporter('metrics', protocol, this.providerName);
    if (!MetricExporterClass) {
      this.logger.debug('[OtelExporter] Metric exporter packages not available. Metric export disabled.');
      this.isMetricSetup = true;
      this.metricSetupFailed = true;
      return false;
    }

    try {
      // Dynamically import the SDK packages
      const sdkMetrics = await import('@opentelemetry/sdk-metrics');
      const { resourceFromAttributes } = await import('@opentelemetry/resources');
      const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');

      const metricEndpoint = this.getSignalEndpoint(resolved, 'metrics');
      const headers = resolved.headers;

      // Create the metric exporter
      let metricExporter: any;
      if (protocol === 'grpc') {
        try {
          const grpcModule = await import('@grpc/grpc-js');
          const metadata = new grpcModule.Metadata();
          Object.entries(headers).forEach(([key, value]) => {
            metadata.set(key, value);
          });
          metricExporter = new MetricExporterClass({ url: metricEndpoint, metadata });
        } catch {
          this.logger.warn('[OtelExporter] Failed to create gRPC metric exporter. Metric export disabled.');
          this.isMetricSetup = true;
          this.metricSetupFailed = true;
          return false;
        }
      } else {
        metricExporter = new MetricExporterClass({
          url: metricEndpoint,
          headers,
        });
      }

      // Create MeterProvider with PeriodicExportingMetricReader
      const resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.observabilityConfig?.serviceName || 'mastra-service',
      });

      this.meterProvider = new sdkMetrics.MeterProvider({
        resource,
        readers: [
          new sdkMetrics.PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 10000, // Export every 10 seconds
            exportTimeoutMillis: this.config.timeout || 30000,
          }),
        ],
      });

      const meter = this.meterProvider.getMeter('@mastra/otel-exporter');
      this.metricCache = new MetricInstrumentCache(meter);

      this.logger.debug(`[OtelExporter] Metric export initialized (endpoint: ${metricEndpoint})`);
      this.isMetricSetup = true;
      return true;
    } catch (error) {
      this.logger.warn(
        '[OtelExporter] Failed to initialize metric export. Required package: @opentelemetry/sdk-metrics',
      );
      this.logger.debug('[OtelExporter] Metric setup error:', error);
      this.isMetricSetup = true;
      this.metricSetupFailed = true;
      return false;
    }
  }

  // ===========================================================================
  // Trace event handler (existing)
  // ===========================================================================

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Check if traces are explicitly disabled
    if (this.config.signals?.traces === false) {
      return;
    }

    // Only process SPAN_ENDED events for OTEL
    // OTEL expects complete spans with start and end times
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    const span = event.exportedSpan;
    await this.exportSpan(span);
  }

  private async exportSpan(span: AnyExportedSpan): Promise<void> {
    // Ensure exporter is set up
    if (!this.isSetup) {
      await this.setup();
    }

    // Skip if disabled
    if (this.isDisabled || !this.processor) {
      return;
    }

    try {
      // Convert the span to OTEL format
      const otelSpan = await this.spanConverter!.convertSpan(span);

      // Export the span immediately through the processor
      // The processor will handle batching if configured
      await new Promise<void>(resolve => {
        this.processor!.onEnd(otelSpan);
        resolve();
      });

      this.logger.debug(
        `[OtelExporter] Exported span ${span.id} (trace: ${span.traceId}, parent: ${span.parentSpanId || 'none'}, type: ${span.type})`,
      );
    } catch (error) {
      this.logger.error(`[OtelExporter] Failed to export span ${span.id}:`, error);
    }
  }

  // ===========================================================================
  // Log event handler (new)
  // ===========================================================================

  async onLogEvent(event: LogEvent): Promise<void> {
    if (this.isDisabled) return;

    const ready = await this.setupLogExporter();
    if (!ready || !this.otelLogger) return;

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

      this.logger.debug(
        `[OtelExporter] Exported log (level: ${event.log.level}, trace: ${event.log.traceId || 'none'})`,
      );
    } catch (error) {
      this.logger.error('[OtelExporter] Failed to export log:', error);
    }
  }

  // ===========================================================================
  // Metric event handler (new)
  // ===========================================================================

  async onMetricEvent(event: MetricEvent): Promise<void> {
    if (this.isDisabled) return;

    const ready = await this.setupMetricExporter();
    if (!ready || !this.metricCache) return;

    try {
      this.metricCache.recordMetric(event.metric);

      this.logger.debug(
        `[OtelExporter] Recorded metric ${event.metric.name} (type: ${event.metric.metricType}, value: ${event.metric.value})`,
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

    if (this.processor) {
      flushPromises.push(this.processor.forceFlush());
    }
    if (this.loggerProvider) {
      flushPromises.push(this.loggerProvider.forceFlush());
    }
    if (this.meterProvider) {
      flushPromises.push(this.meterProvider.forceFlush());
    }

    if (flushPromises.length > 0) {
      await Promise.all(flushPromises);
      this.logger.debug('[OtelExporter] Flushed all pending data');
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
