/**
 * OpenTelemetry AI Tracing Exporter for Mastra
 */

import { AITracingEventType } from '@mastra/core/ai-tracing';
import type { AITracingExporter, AITracingEvent, AnyExportedAISpan, TracingConfig } from '@mastra/core/ai-tracing';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { loadExporter } from './loadExporter.js';
import { resolveProviderConfig } from './provider-configs.js';
import { SpanConverter } from './span-converter.js';
import type { OtelExporterConfig } from './types.js';

export class OtelExporter implements AITracingExporter {
  private config: OtelExporterConfig;
  private tracingConfig?: TracingConfig;
  private spanConverter: SpanConverter;
  private processor?: BatchSpanProcessor;
  private exporter?: SpanExporter;
  private isSetup: boolean = false;
  private isDisabled: boolean = false;

  name = 'opentelemetry';

  constructor(config: OtelExporterConfig) {
    this.config = config;
    this.spanConverter = new SpanConverter();

    // Set up OpenTelemetry diagnostics if debug mode
    if (config.logLevel === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }
  }

  /**
   * Initialize with tracing configuration
   */
  init(config: TracingConfig): void {
    this.tracingConfig = config;
  }

  private async setupExporter() {
    if (this.isSetup) return;

    // Provider configuration is required
    if (!this.config.provider) {
      console.error(
        '[OtelExporter] Provider configuration is required. Use the "custom" provider for generic endpoints.',
      );
      this.isDisabled = true;
      this.isSetup = true;
      return;
    }

    // Resolve provider configuration
    const resolved = resolveProviderConfig(this.config.provider);
    if (!resolved) {
      // Configuration validation failed, disable tracing
      this.isDisabled = true;
      this.isSetup = true;
      return;
    }

    const endpoint = resolved.endpoint;
    const headers = resolved.headers;
    const protocol = resolved.protocol;

    // Load and create the appropriate exporter based on protocol
    const providerName = Object.keys(this.config.provider)[0];
    const ExporterClass = await loadExporter(protocol, providerName);

    if (!ExporterClass) {
      // Exporter not available, disable tracing
      this.isDisabled = true;
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
          // @ts-ignore - Dynamic import for optional dependency
          const grpcModule = await import('@grpc/grpc-js');
          metadata = new grpcModule.Metadata();
          Object.entries(headers).forEach(([key, value]) => {
            metadata.set(key, value);
          });
        } catch (grpcError) {
          console.error(
            `[OtelExporter] Failed to load gRPC metadata. Install required packages:\n` +
              `  npm install @opentelemetry/exporter-trace-otlp-grpc @grpc/grpc-js\n`,
            grpcError,
          );
          this.isDisabled = true;
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
      console.error(`[OtelExporter] Failed to create exporter:`, error);
      this.isDisabled = true;
      this.isSetup = true;
      return;
    }

    // Create resource with service name from TracingConfig
    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: this.tracingConfig?.serviceName || 'mastra-service',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      // Add telemetry SDK information
      [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@mastra/otel-exporter',
      [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: '1.0.0',
      [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: 'nodejs',
    });

    // Store the resource for the span converter
    this.spanConverter = new SpanConverter(resource);

    // Always use BatchSpanProcessor for production
    // It queues spans and exports them in batches for better performance
    this.processor = new BatchSpanProcessor(this.exporter!, {
      maxExportBatchSize: this.config.batchSize || 512, // Default batch size
      maxQueueSize: 2048, // Maximum spans to queue
      scheduledDelayMillis: 5000, // Export every 5 seconds
      exportTimeoutMillis: this.config.timeout || 30000, // Export timeout
    });

    if (this.config.logLevel === 'debug') {
      console.log(`[OtelExporter] Using BatchSpanProcessor (batch size: ${this.config.batchSize || 512}, delay: 5s)`);
    }

    this.isSetup = true;
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    // Skip if disabled due to configuration errors
    if (this.isDisabled) {
      return;
    }

    // Only process SPAN_ENDED events for OTEL
    // OTEL expects complete spans with start and end times
    if (event.type !== AITracingEventType.SPAN_ENDED) {
      return;
    }

    const span = event.exportedSpan;
    await this.exportSpan(span);
  }

  private async exportSpan(span: AnyExportedAISpan): Promise<void> {
    // Ensure exporter is set up
    if (!this.isSetup) {
      await this.setupExporter();
    }

    // Skip if disabled
    if (this.isDisabled || !this.processor) {
      return;
    }

    try {
      // Convert the span to OTEL format
      const readableSpan = this.spanConverter.convertSpan(span);

      // Export the span immediately through the processor
      // The processor will handle batching if configured
      await new Promise<void>(resolve => {
        this.processor!.onEnd(readableSpan);
        resolve();
      });

      if (this.config.logLevel === 'debug') {
        console.log(
          `[OtelExporter] Exported span ${span.id} (trace: ${span.traceId}, parent: ${span.parentSpanId || 'none'}, type: ${span.type})`,
        );
      }
    } catch (error) {
      console.error(`[OtelExporter] Failed to export span ${span.id}:`, error);
    }
  }

  async shutdown(): Promise<void> {
    // Shutdown the processor to flush any remaining spans
    if (this.processor) {
      await this.processor.shutdown();
    }
  }
}
