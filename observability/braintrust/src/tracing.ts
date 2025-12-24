/**
 * Braintrust Exporter for Mastra Observability
 *
 * This exporter sends observability data to Braintrust.
 * Root spans become top-level Braintrust spans (no trace wrapper).
 * Events are handled as zero-duration spans with matching start/end times.
 */

import type { AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import type { BaseTraceData, TrackingExporterConfig } from '@mastra/observability';
import { TrackingExporter } from '@mastra/observability';
import { initLogger, currentSpan } from 'braintrust';
import type { Span, Logger } from 'braintrust';
import { formatUsageMetrics } from './metrics';

const MASTRA_TRACE_ID_METADATA_KEY = 'mastra-trace-id';

export interface BraintrustExporterConfig extends TrackingExporterConfig {
  /**
   * Optional Braintrust logger instance.
   * When provided, enables integration with Braintrust contexts such as:
   * - Evals: Agent traces nest inside eval task spans
   * - logger.traced(): Agent traces nest inside traced spans
   * - Parent spans: Auto-detects and attaches to external Braintrust spans
   */
  braintrustLogger?: Logger<true>;

  /** Braintrust API key. Required if logger is not provided. */
  apiKey?: string;
  /** Optional custom endpoint */
  endpoint?: string;
  /** Braintrust project name (default: 'mastra-tracing') */
  projectName?: string;
  /** Support tuning parameters */
  tuningParameters?: Record<string, any>;
}

interface BraintrustTraceData extends BaseTraceData {
  logger: Logger<true> | Span;
  spans: Map<string, Span>;
  isExternal: boolean;
}

// Default span type for all spans
const DEFAULT_SPAN_TYPE = 'task';

// Exceptions to the default mapping
const SPAN_TYPE_EXCEPTIONS: Partial<Record<SpanType, string>> = {
  [SpanType.MODEL_GENERATION]: 'llm',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: 'function',
  [SpanType.WORKFLOW_WAIT_EVENT]: 'function',
};

// Mapping function - returns valid Braintrust span types
function mapSpanType(spanType: SpanType): 'llm' | 'score' | 'function' | 'eval' | 'task' | 'tool' {
  return (SPAN_TYPE_EXCEPTIONS[spanType] as any) ?? DEFAULT_SPAN_TYPE;
}

export class BraintrustExporter extends TrackingExporter<BraintrustTraceData, BraintrustExporterConfig> {
  name = 'braintrust';

  // Flags and logger for context-aware mode
  private useProvidedLogger: boolean;
  private providedLogger?: Logger<true>;

  constructor(config: BraintrustExporterConfig) {
    super(config);

    if (config.braintrustLogger) {
      // Use provided logger - enables Braintrust context integration
      this.useProvidedLogger = true;
      this.providedLogger = config.braintrustLogger;
    } else {
      // Validate apiKey for creating loggers per trace
      if (!config.apiKey) {
        this.setDisabled(`Missing required credentials (apiKey: ${!!config.apiKey})`);
        this.useProvidedLogger = false;
        return;
      }
      this.useProvidedLogger = false;
    }
  }

  // ==================== TrackingExporter Implementation ====================

  protected async createTraceData(span: AnyExportedSpan): Promise<BraintrustTraceData> {
    if (this.useProvidedLogger) {
      return this.createTraceDataWithContext(span);
    } else {
      return this.createTraceDataPerTrace(span);
    }
  }

  private async createTraceDataPerTrace(_span: AnyExportedSpan): Promise<BraintrustTraceData> {
    try {
      const loggerInstance = await initLogger({
        projectName: this.exporterConfig.projectName ?? 'mastra-tracing',
        apiKey: this.exporterConfig.apiKey,
        appUrl: this.exporterConfig.endpoint,
        ...this.exporterConfig.tuningParameters,
      });

      return {
        activeSpanIds: new Set(),
        logger: loggerInstance,
        spans: new Map(),
        isExternal: false,
      };
    } catch (err) {
      this.logger.error('Braintrust exporter: Failed to initialize logger', { error: err });
      this.setDisabled('Failed to initialize Braintrust logger');
      throw err;
    }
  }

  private async createTraceDataWithContext(_span: AnyExportedSpan): Promise<BraintrustTraceData> {
    // Try to find a Braintrust span to attach to:
    // 1. Auto-detect from Braintrust's current span (logger.traced(), Eval(), etc.)
    // 2. Fall back to the configured logger
    const braintrustSpan = currentSpan();

    // Check if it's a valid span (not the NOOP_SPAN)
    if (braintrustSpan && braintrustSpan.id) {
      // External span detected - attach Mastra traces to it
      return {
        activeSpanIds: new Set(),
        logger: braintrustSpan,
        spans: new Map(),
        isExternal: true,
      };
    } else {
      // No external span - use provided logger
      return {
        activeSpanIds: new Set(),
        logger: this.providedLogger!,
        spans: new Map(),
        isExternal: false,
      };
    }
  }

  protected async handleSpanStarted(span: AnyExportedSpan, traceData: BraintrustTraceData): Promise<void> {
    const braintrustParent = this.getBraintrustParent(traceData, span, 'handleSpanStarted');
    if (!braintrustParent) {
      return;
    }

    const payload = this.buildSpanPayload(span);

    const braintrustSpan = braintrustParent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      ...payload,
    });

    // Include the Mastra trace ID in the span metadata for correlation
    // Also include tags if present (only for root spans)
    braintrustSpan.log({
      metadata: {
        [MASTRA_TRACE_ID_METADATA_KEY]: span.traceId,
      },
      ...(span.isRootSpan && span.tags?.length ? { tags: span.tags } : {}),
    });

    traceData.spans.set(span.id, braintrustSpan);
  }

  protected async handleSpanUpdated(span: AnyExportedSpan, traceData: BraintrustTraceData): Promise<void> {
    const braintrustSpan = traceData.spans.get(span.id);
    if (!braintrustSpan) {
      this.logger.warn('Braintrust exporter: No Braintrust span found for span update', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
      });
      return;
    }

    braintrustSpan.log(this.buildSpanPayload(span));
  }

  protected async handleSpanEnded(span: AnyExportedSpan, traceData: BraintrustTraceData): Promise<void> {
    const braintrustSpan = traceData.spans.get(span.id);
    if (!braintrustSpan) {
      this.logger.warn('Braintrust exporter: No Braintrust span found for span end', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
      });
      return;
    }

    braintrustSpan.log(this.buildSpanPayload(span));

    // End the span with the correct endTime (convert milliseconds to seconds)
    if (span.endTime) {
      braintrustSpan.end({ endTime: span.endTime.getTime() / 1000 });
    } else {
      braintrustSpan.end();
    }
  }

  protected async handleEventSpan(span: AnyExportedSpan, traceData: BraintrustTraceData): Promise<void> {
    const braintrustParent = this.getBraintrustParent(traceData, span, 'handleEventSpan');
    if (!braintrustParent) {
      return;
    }

    const payload = this.buildSpanPayload(span);

    // Create zero-duration span for event (convert milliseconds to seconds)
    const braintrustSpan = braintrustParent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      startTime: span.startTime.getTime() / 1000,
      ...payload,
    });

    braintrustSpan.end({ endTime: span.startTime.getTime() / 1000 });
  }

  /**
   * Override markSpanEnded to handle external spans specially.
   * Don't clean up if using external spans (they're managed by Braintrust).
   */
  protected async markSpanEnded(traceId: string, traceData: BraintrustTraceData, spanId: string): Promise<boolean> {
    traceData.activeSpanIds.delete(spanId);

    // Don't clean up if using external spans
    if (traceData.isExternal) {
      return false;
    }

    // Clean up trace if no more active spans
    if (traceData.activeSpanIds.size === 0) {
      await this.removeTrace(traceId, traceData);
      return true;
    }

    return false;
  }

  protected async cleanupTraceData(traceData: BraintrustTraceData, _traceId: string): Promise<void> {
    // End all active spans
    for (const [_spanId, span] of traceData.spans) {
      span.end();
    }
    // Loggers don't have an explicit shutdown method
  }

  // ==================== Helper Methods ====================

  private getBraintrustParent(
    traceData: BraintrustTraceData,
    span: AnyExportedSpan,
    method: string,
  ): Logger<true> | Span | undefined {
    const parentId = span.parentSpanId;
    if (!parentId) {
      return traceData.logger;
    }

    if (traceData.spans.has(parentId)) {
      return traceData.spans.get(parentId);
    }

    // If the parent exists but is the root span (not represented as a Braintrust
    // span because we use the logger as the root), attach to the logger so the
    // span is not orphaned. We need to check if parentSpanId exists but the
    // parent span is not in our spans map (indicating it's the root span).
    if (parentId && !traceData.spans.has(parentId)) {
      // This means the parent exists but isn't tracked as a Braintrust span,
      // which happens when the parent is the root span (we use logger as root)
      return traceData.logger;
    }

    this.logger.warn('Braintrust exporter: No parent data found for span', {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
      spanType: span.type,
      isRootSpan: span.isRootSpan,
      parentSpanId: span.parentSpanId,
      method,
    });

    return undefined;
  }

  /**
   * Transforms MODEL_GENERATION input to Braintrust Thread view format.
   */
  private transformInput(input: any, spanType: SpanType): any {
    if (spanType === SpanType.MODEL_GENERATION) {
      if (input && Array.isArray(input.messages)) {
        return input.messages;
      } else if (input && typeof input === 'object' && 'content' in input) {
        return [{ role: input.role, content: input.content }];
      }
    }

    return input;
  }

  /**
   * Transforms MODEL_GENERATION output to Braintrust Thread view format.
   */
  private transformOutput(output: any, spanType: SpanType): any {
    if (spanType === SpanType.MODEL_GENERATION) {
      const { text, ...rest } = output;
      return { role: 'assistant', content: text, ...rest };
    }

    return output;
  }

  private buildSpanPayload(span: AnyExportedSpan): Record<string, any> {
    const payload: Record<string, any> = {};

    if (span.input !== undefined) {
      payload.input = this.transformInput(span.input, span.type);
    }

    if (span.output !== undefined) {
      payload.output = this.transformOutput(span.output, span.type);
    }

    // Initialize metrics and metadata objects
    payload.metrics = {};
    payload.metadata = {
      spanType: span.type,
      ...span.metadata,
    };

    const attributes = (span.attributes ?? {}) as Record<string, any>;

    if (span.type === SpanType.MODEL_GENERATION) {
      const modelAttr = attributes as ModelGenerationAttributes;

      // Model goes to metadata
      if (modelAttr.model !== undefined) {
        payload.metadata.model = modelAttr.model;
      }

      // Provider goes to metadata (if provided by attributes)
      if (modelAttr.provider !== undefined) {
        payload.metadata.provider = modelAttr.provider;
      }

      // Usage/token info goes to metrics
      payload.metrics = formatUsageMetrics(modelAttr.usage);

      // Time to first token (TTFT) for streaming responses
      // Braintrust expects TTFT in seconds (not milliseconds)
      if (modelAttr.completionStartTime) {
        payload.metrics.time_to_first_token =
          (modelAttr.completionStartTime.getTime() - span.startTime.getTime()) / 1000;
      }

      // Model parameters go to metadata
      if (modelAttr.parameters !== undefined) {
        payload.metadata.modelParameters = modelAttr.parameters;
      }

      // Other LLM attributes go to metadata
      const otherAttributes = omitKeys(attributes, ['model', 'usage', 'parameters', 'completionStartTime']);
      payload.metadata = {
        ...payload.metadata,
        ...otherAttributes,
      };
    } else {
      // For non-LLM spans, put all attributes in metadata
      payload.metadata = {
        ...payload.metadata,
        ...attributes,
      };
    }

    // Handle errors
    if (span.errorInfo) {
      payload.error = span.errorInfo.message;
      payload.metadata.errorDetails = span.errorInfo;
    }

    // Clean up empty metrics object
    if (Object.keys(payload.metrics).length === 0) {
      delete payload.metrics;
    }

    return payload;
  }

  async shutdown(): Promise<void> {
    if (!this.exporterConfig) {
      return;
    }
    await super.shutdown();
  }
}
