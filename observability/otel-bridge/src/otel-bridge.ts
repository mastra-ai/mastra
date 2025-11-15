/**
 * OpenTelemetry Bridge for Mastra
 *
 * Makes Mastra participate in an existing OpenTelemetry trace context by:
 * - Reading the current OTEL context and creating child spans
 * - Mirroring Mastra span lifecycle to OTEL spans
 * - Respecting OTEL sampling decisions
 * - Mapping Mastra attributes to OTEL semantic conventions
 */

import { AITracingEventType } from '@mastra/core/ai-tracing';
import type { AITracingExporter, AITracingEvent, AnyExportedAISpan, TracingConfig } from '@mastra/core/ai-tracing';
import { ConsoleLogger } from '@mastra/core/logger';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';
import type { Span, Tracer, SpanContext } from '@opentelemetry/api';
import { AISpanType } from '@mastra/core/ai-tracing';

import { AttributeMapper } from './attribute-mapper.js';
import type { OtelBridgeConfig, BridgedSpanRegistry, BridgedSpanData } from './types.js';

/**
 * Map Mastra span types to OpenTelemetry span kinds
 */
const SPAN_KIND_MAPPING: Partial<Record<AISpanType, SpanKind>> = {
  // LLM operations are CLIENT spans (calling external AI services)
  [AISpanType.LLM_GENERATION]: SpanKind.CLIENT,
  [AISpanType.LLM_CHUNK]: SpanKind.CLIENT,

  // MCP tool calls are CLIENT (external service calls)
  [AISpanType.MCP_TOOL_CALL]: SpanKind.CLIENT,

  // Root spans for agent/workflow are SERVER (entry points)
  [AISpanType.AGENT_RUN]: SpanKind.SERVER,
  [AISpanType.WORKFLOW_RUN]: SpanKind.SERVER,
};

export class OtelBridge implements AITracingExporter {
  name = 'otel-bridge';

  private config: OtelBridgeConfig;
  private tracingConfig?: TracingConfig;
  private tracer: Tracer;
  private attributeMapper: AttributeMapper;
  private registry: BridgedSpanRegistry;
  private logger: ConsoleLogger;

  constructor(config: OtelBridgeConfig = {}) {
    this.config = {
      tracerName: 'mastra',
      tracerVersion: '1.0.0',
      attributePrefix: 'mastra.',
      forceExport: false,
      logLevel: 'warn',
      ...config,
    };

    // Get or create a tracer from the global tracer provider
    this.tracer = trace.getTracer(this.config.tracerName!, this.config.tracerVersion!);

    // Initialize attribute mapper
    this.attributeMapper = new AttributeMapper(this.config.attributePrefix);

    // Initialize span registry
    this.registry = {
      spans: new Map(),
      traceSpans: new Map(),
    };

    // Initialize logger
    this.logger = new ConsoleLogger({ level: this.config.logLevel });

    // Set up OpenTelemetry diagnostics if debug mode
    if (this.config.logLevel === 'debug') {
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    }

    this.logger.debug('[OtelBridge] Initialized with config:', this.config);
  }

  /**
   * Initialize with tracing configuration
   */
  init(config: TracingConfig): void {
    this.tracingConfig = config;
    this.logger.debug('[OtelBridge] Initialized with tracing config:', config.serviceName);
  }

  /**
   * Export tracing events by mirroring to OTEL spans
   */
  async exportEvent(event: AITracingEvent): Promise<void> {
    try {
      switch (event.type) {
        case AITracingEventType.SPAN_STARTED:
          await this.handleSpanStarted(event.exportedSpan);
          break;
        case AITracingEventType.SPAN_UPDATED:
          await this.handleSpanUpdated(event.exportedSpan);
          break;
        case AITracingEventType.SPAN_ENDED:
          await this.handleSpanEnded(event.exportedSpan);
          break;
      }
    } catch (error) {
      this.logger.error('[OtelBridge] Error processing event:', error);
    }
  }

  /**
   * Handle span started event - create corresponding OTEL span
   */
  private async handleSpanStarted(mastraSpan: AnyExportedAISpan): Promise<void> {
    // Check if span already exists (shouldn't happen, but defensive)
    if (this.registry.spans.has(mastraSpan.id)) {
      this.logger.warn(`[OtelBridge] Span ${mastraSpan.id} already exists, skipping start`);
      return;
    }

    // Get the current OTEL context
    const activeContext = context.active();
    const activeSpanContext = trace.getSpanContext(activeContext);

    // Determine parent context for this span
    let parentContext = activeContext;

    // If this Mastra span has a parent, try to find the corresponding OTEL span
    if (mastraSpan.parentSpanId) {
      const parentBridgedSpan = this.registry.spans.get(mastraSpan.parentSpanId);
      if (parentBridgedSpan) {
        // Set the parent OTEL span as the parent context
        parentContext = trace.setSpan(activeContext, parentBridgedSpan.otelSpan);
        this.logger.debug(
          `[OtelBridge] Using bridged parent span ${mastraSpan.parentSpanId} for span ${mastraSpan.id}`,
        );
      }
    }

    // Check sampling decision from OTEL context
    const shouldSample = this.shouldSampleSpan(activeSpanContext);
    if (!shouldSample && !this.config.forceExport) {
      this.logger.debug(
        `[OtelBridge] Skipping span ${mastraSpan.id} - not sampled and forceExport is false`,
      );
      return;
    }

    // Determine span kind
    const spanKind = this.getSpanKind(mastraSpan);

    // Build span name
    const spanName = this.buildSpanName(mastraSpan);

    // Get start time in milliseconds
    const startTime = mastraSpan.startTime.getTime();

    // Start OTEL span with the appropriate parent context
    const otelSpan = this.tracer.startSpan(
      spanName,
      {
        kind: spanKind,
        startTime,
        attributes: this.config.resourceAttributes || {},
      },
      parentContext,
    );

    // Set initial attributes
    const attributes = this.attributeMapper.buildAttributes(mastraSpan);
    otelSpan.setAttributes(attributes);

    // Store in registry
    const bridgedSpan: BridgedSpanData = {
      mastraSpan,
      otelSpan,
      ended: false,
    };

    this.registry.spans.set(mastraSpan.id, bridgedSpan);

    // Track by trace
    if (!this.registry.traceSpans.has(mastraSpan.traceId)) {
      this.registry.traceSpans.set(mastraSpan.traceId, new Set());
    }
    this.registry.traceSpans.get(mastraSpan.traceId)!.add(mastraSpan.id);

    this.logger.debug(
      `[OtelBridge] Started span ${mastraSpan.id} (trace: ${mastraSpan.traceId}, ` +
        `parent: ${mastraSpan.parentSpanId || 'none'}, ` +
        `type: ${mastraSpan.type}, ` +
        `kind: ${SpanKind[spanKind]})`,
    );
  }

  /**
   * Handle span updated event - update OTEL span attributes
   */
  private async handleSpanUpdated(mastraSpan: AnyExportedAISpan): Promise<void> {
    const bridgedSpan = this.registry.spans.get(mastraSpan.id);

    if (!bridgedSpan) {
      this.logger.debug(`[OtelBridge] Span ${mastraSpan.id} not found in registry, cannot update`);
      return;
    }

    if (bridgedSpan.ended) {
      this.logger.warn(`[OtelBridge] Span ${mastraSpan.id} already ended, cannot update`);
      return;
    }

    // Update Mastra span reference
    bridgedSpan.mastraSpan = mastraSpan;

    // Rebuild and update attributes
    const attributes = this.attributeMapper.buildAttributes(mastraSpan);
    bridgedSpan.otelSpan.setAttributes(attributes);

    this.logger.debug(`[OtelBridge] Updated span ${mastraSpan.id}`);
  }

  /**
   * Handle span ended event - end OTEL span and clean up
   */
  private async handleSpanEnded(mastraSpan: AnyExportedAISpan): Promise<void> {
    const bridgedSpan = this.registry.spans.get(mastraSpan.id);

    if (!bridgedSpan) {
      this.logger.debug(`[OtelBridge] Span ${mastraSpan.id} not found in registry, cannot end`);
      return;
    }

    if (bridgedSpan.ended) {
      this.logger.warn(`[OtelBridge] Span ${mastraSpan.id} already ended`);
      return;
    }

    // Update Mastra span reference
    bridgedSpan.mastraSpan = mastraSpan;

    // Set final attributes
    const attributes = this.attributeMapper.buildAttributes(mastraSpan);
    bridgedSpan.otelSpan.setAttributes(attributes);

    // Set span status based on error info
    if (mastraSpan.errorInfo) {
      bridgedSpan.otelSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: mastraSpan.errorInfo.message,
      });

      // Record exception event
      bridgedSpan.otelSpan.recordException({
        name: 'Error',
        message: mastraSpan.errorInfo.message,
        stack: mastraSpan.errorInfo.details?.stack as string | undefined,
      });
    } else {
      bridgedSpan.otelSpan.setStatus({ code: SpanStatusCode.OK });
    }

    // End the OTEL span with the Mastra span's end time
    const endTime = mastraSpan.endTime?.getTime();
    bridgedSpan.otelSpan.end(endTime);

    // Mark as ended
    bridgedSpan.ended = true;

    this.logger.debug(
      `[OtelBridge] Ended span ${mastraSpan.id} (trace: ${mastraSpan.traceId}, ` +
        `duration: ${attributes[`${this.config.attributePrefix}latency_ms`] || 'unknown'}ms)`,
    );

    // Clean up completed traces
    this.cleanupCompletedTrace(mastraSpan.traceId);
  }

  /**
   * Clean up completed traces from registry
   */
  private cleanupCompletedTrace(traceId: string): void {
    const spanIds = this.registry.traceSpans.get(traceId);
    if (!spanIds) return;

    // Check if all spans in the trace are ended
    const allEnded = Array.from(spanIds).every(spanId => {
      const bridgedSpan = this.registry.spans.get(spanId);
      return bridgedSpan?.ended || false;
    });

    if (allEnded) {
      // Remove all spans for this trace
      spanIds.forEach(spanId => this.registry.spans.delete(spanId));
      this.registry.traceSpans.delete(traceId);

      this.logger.debug(`[OtelBridge] Cleaned up trace ${traceId} (${spanIds.size} spans)`);
    }
  }

  /**
   * Determine if a span should be sampled based on OTEL context
   */
  private shouldSampleSpan(spanContext: SpanContext | undefined): boolean {
    if (!spanContext) {
      // No active context, default to sampling
      return true;
    }

    // Check if the trace is sampled (trace flags bit 0)
    const isSampled = (spanContext.traceFlags & 0x01) === 0x01;
    return isSampled;
  }

  /**
   * Get the appropriate SpanKind based on span type
   */
  private getSpanKind(aiSpan: AnyExportedAISpan): SpanKind {
    // Root spans should be SERVER
    if (aiSpan.isRootSpan) {
      if (aiSpan.type === AISpanType.AGENT_RUN || aiSpan.type === AISpanType.WORKFLOW_RUN) {
        return SpanKind.SERVER;
      }
    }
    return SPAN_KIND_MAPPING[aiSpan.type] || SpanKind.INTERNAL;
  }

  /**
   * Build OTEL-compliant span name based on span type
   */
  private buildSpanName(aiSpan: AnyExportedAISpan): string {
    switch (aiSpan.type) {
      case AISpanType.LLM_GENERATION: {
        const attrs = aiSpan.attributes as any;
        const operation = attrs?.resultType === 'tool_selection' ? 'tool_selection' : 'chat';
        const model = attrs?.model || 'unknown';
        return `${operation} ${model}`;
      }

      case AISpanType.TOOL_CALL:
      case AISpanType.MCP_TOOL_CALL: {
        const toolAttrs = aiSpan.attributes as any;
        const toolName = toolAttrs?.toolId || 'unknown';
        return `tool.execute ${toolName}`;
      }

      case AISpanType.AGENT_RUN: {
        const agentAttrs = aiSpan.attributes as any;
        const agentId = agentAttrs?.agentId || 'unknown';
        return `agent.${agentId}`;
      }

      case AISpanType.WORKFLOW_RUN: {
        const workflowAttrs = aiSpan.attributes as any;
        const workflowId = workflowAttrs?.workflowId || 'unknown';
        return `workflow.${workflowId}`;
      }

      default:
        return aiSpan.name;
    }
  }

  /**
   * Shutdown the bridge and clean up resources
   */
  async shutdown(): Promise<void> {
    // End any remaining active spans
    this.registry.spans.forEach((bridgedSpan, spanId) => {
      if (!bridgedSpan.ended) {
        this.logger.warn(`[OtelBridge] Force-ending span ${spanId} during shutdown`);
        bridgedSpan.otelSpan.end();
        bridgedSpan.ended = true;
      }
    });

    // Clear registry
    this.registry.spans.clear();
    this.registry.traceSpans.clear();

    this.logger.debug('[OtelBridge] Shutdown complete');
  }
}
