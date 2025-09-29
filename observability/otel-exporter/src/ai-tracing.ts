/**
 * OpenTelemetry AI Tracing Exporter for Mastra
 */

import { AITracingEventType } from '@mastra/core/ai-tracing';
import type { AITracingExporter, AITracingEvent, AnyExportedAISpan } from '@mastra/core/ai-tracing';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { defaultResource } from '@opentelemetry/resources';
import { SimpleSpanProcessor, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { loadExporter } from './loadExporter.js';
import { resolveProviderConfig } from './provider-configs.js';
import { SpanConverter } from './span-converter.js';
import type { OtelExporterConfig, TraceData } from './types.js';

export class OtelExporter implements AITracingExporter {
  private config: OtelExporterConfig;
  private traceMap: Map<string, TraceData> = new Map();
  private spanConverter: SpanConverter;
  private tracerProvider?: NodeTracerProvider;
  private exporter?: SpanExporter;
  private isSetup: boolean = false;
  private isDisabled: boolean = false;
  private exportTimeout?: NodeJS.Timeout;
  private readonly EXPORT_DELAY_MS = 5000; // Wait 5 seconds after root span completes

  name = 'opentelemetry';

  constructor(config: OtelExporterConfig) {
    this.config = config;
    this.spanConverter = new SpanConverter();

    // Set up OpenTelemetry diagnostics if debug mode
    if (config.logLevel === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }
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

    // Create default resource
    const resource = defaultResource();

    // Store the resource for the span converter
    this.spanConverter = new SpanConverter(resource);

    // Use BatchSpanProcessor for better performance
    const processor = this.config.batchSize
      ? new BatchSpanProcessor(this.exporter!, {
          maxExportBatchSize: this.config.batchSize,
        })
      : new SimpleSpanProcessor(this.exporter!);

    this.tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [processor],
    } as any);

    // Register the provider
    this.tracerProvider.register();

    this.isSetup = true;
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    // Skip if disabled due to configuration errors
    if (this.isDisabled) {
      return;
    }

    if (
      event.type !== AITracingEventType.SPAN_ENDED &&
      event.type !== AITracingEventType.SPAN_UPDATED &&
      event.type !== AITracingEventType.SPAN_STARTED
    ) {
      return;
    }

    const span = event.exportedSpan;
    await this.processSpan(span);
  }

  private async processSpan(span: AnyExportedAISpan): Promise<void> {
    // Ensure exporter is set up
    if (!this.isSetup) {
      await this.setupExporter();
    }

    // Skip if disabled
    if (this.isDisabled) {
      return;
    }

    // Get or create trace data
    let traceData = this.traceMap.get(span.traceId);

    if (!traceData) {
      // First span in trace - must be root
      traceData = {
        spans: new Map(),
        rootSpanId: span.id,
        isRootComplete: false,
      };
      this.traceMap.set(span.traceId, traceData);
    }

    // Store span data
    const isComplete = !!span.endTime;
    traceData.spans.set(span.id, { span, isComplete });

    // Check if this is the root span completing
    if (span.id === traceData.rootSpanId && isComplete) {
      traceData.isRootComplete = true;

      // Schedule export after delay to allow child spans to complete
      await this.scheduleExport(span.traceId);
    }
  }

  private async scheduleExport(traceId: string) {
    // Clear any existing timeout for this trace
    if (this.exportTimeout) {
      clearTimeout(this.exportTimeout);
    }

    // Schedule export after delay
    this.exportTimeout = setTimeout(async () => {
      await this.exportTrace(traceId);
    }, this.EXPORT_DELAY_MS);
  }

  private async exportTrace(traceId: string) {
    const traceData = this.traceMap.get(traceId);
    if (!traceData || !traceData.isRootComplete) {
      return;
    }

    try {
      // Build parent-child relationships
      const rootSpan = traceData.spans.get(traceData.rootSpanId);

      if (!rootSpan) {
        console.warn(`Root span ${traceData.rootSpanId} not found for trace ${traceId}`);
        return;
      }

      // Convert all spans to ReadableSpans
      const readableSpans: any[] = [];

      // Convert all spans - Mastra already provides correct parentSpanId
      for (const [, spanData] of traceData.spans) {
        const readableSpan = this.spanConverter.convertSpan(spanData.span);
        readableSpans.push(readableSpan);
      }

      // Export the readable spans directly through the exporter
      if (this.exporter && 'export' in this.exporter) {
        await (this.exporter as any).export(readableSpans, (result: any) => {
          if (result.code !== 0) {
            console.error(`Failed to export trace ${traceId}:`, result.error);
          }
        });
      }

      // Clean up trace data
      this.traceMap.delete(traceId);
    } catch (error) {
      console.error(`Failed to export trace ${traceId}:`, error);
    }
  }

  async shutdown(): Promise<void> {
    // Clear any pending exports
    if (this.exportTimeout) {
      clearTimeout(this.exportTimeout);
    }

    // Export any remaining traces
    for (const [traceId, traceData] of this.traceMap) {
      if (traceData.isRootComplete) {
        await this.exportTrace(traceId);
      }
    }

    // Shutdown tracer provider
    if (this.tracerProvider) {
      await this.tracerProvider.shutdown();
    }
  }
}
