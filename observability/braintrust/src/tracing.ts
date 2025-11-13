/**
 * Braintrust Exporter for Mastra Observability
 *
 * This exporter sends observability data to Braintrust.
 * Root spans become top-level Braintrust spans (no trace wrapper).
 * Events are handled as zero-duration spans with matching start/end times.
 */

import type { TracingEvent, AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { BaseExporter } from '@mastra/observability';
import type { BaseExporterConfig } from '@mastra/observability';
import { initLogger } from 'braintrust';
import type { Span, Logger } from 'braintrust';
import { normalizeUsageMetrics } from './metrics';

export interface BraintrustExporterConfig extends BaseExporterConfig {
  /** Braintrust API key */
  apiKey?: string;
  /** Optional custom endpoint */
  endpoint?: string;
  /** Braintrust project name (default: 'mastra-tracing') */
  projectName?: string;
  /** Support tuning parameters */
  tuningParameters?: Record<string, any>;
}

type SpanData = {
  logger: Logger<true>; // Braintrust logger (for root spans)
  spans: Map<string, Span>; // Maps span.id to Braintrust span
  activeIds: Set<string>; // Tracks started (non-event) spans not yet ended, including root
};

// Default span type for all spans
const DEFAULT_SPAN_TYPE = 'task';

// Exceptions to the default mapping
const SPAN_TYPE_EXCEPTIONS: Partial<Record<SpanType, string>> = {
  [SpanType.MODEL_GENERATION]: 'llm',
  [SpanType.MODEL_CHUNK]: 'llm',
  [SpanType.TOOL_CALL]: 'tool',
  [SpanType.MCP_TOOL_CALL]: 'tool',
  [SpanType.WORKFLOW_CONDITIONAL_EVAL]: 'function',
  [SpanType.WORKFLOW_WAIT_EVENT]: 'function',
};

// Mapping function - returns valid Braintrust span types
function mapSpanType(spanType: SpanType): 'llm' | 'score' | 'function' | 'eval' | 'task' | 'tool' {
  return (SPAN_TYPE_EXCEPTIONS[spanType] as any) ?? DEFAULT_SPAN_TYPE;
}

export class BraintrustExporter extends BaseExporter {
  name = 'braintrust';
  private traceMap = new Map<string, SpanData>();
  private config: BraintrustExporterConfig;

  constructor(config: BraintrustExporterConfig) {
    super(config);

    if (!config.apiKey) {
      this.setDisabled(`Missing required credentials (apiKey: ${!!config.apiKey})`);
      this.config = null as any;
      return;
    }

    this.config = config;
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.exportedSpan.isEvent) {
      await this.handleEventSpan(event.exportedSpan);
      return;
    }

    switch (event.type) {
      case 'span_started':
        await this.handleSpanStarted(event.exportedSpan);
        break;
      case 'span_updated':
        await this.handleSpanUpdateOrEnd(event.exportedSpan, false);
        break;
      case 'span_ended':
        await this.handleSpanUpdateOrEnd(event.exportedSpan, true);
        break;
    }
  }

  private async handleSpanStarted(span: AnyExportedSpan): Promise<void> {
    if (span.isRootSpan) {
      await this.initLogger(span);
    }

    const method = 'handleSpanStarted';
    const spanData = this.getSpanData({ span, method });
    if (!spanData) {
      return;
    }

    // Refcount: track active non-event spans (including root)
    if (!span.isEvent) {
      spanData.activeIds.add(span.id);
    }

    const braintrustParent = this.getBraintrustParent({ spanData, span, method });
    if (!braintrustParent) {
      return;
    }

    const payload = this.buildSpanPayload(span);

    const braintrustSpan = braintrustParent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      parentSpanIds: span.parentSpanId
        ? { spanId: span.parentSpanId, rootSpanId: span.traceId }
        : { spanId: span.traceId, rootSpanId: span.traceId },
      ...payload,
    });

    spanData.spans.set(span.id, braintrustSpan);
  }

  private async handleSpanUpdateOrEnd(span: AnyExportedSpan, isEnd: boolean): Promise<void> {
    const method = isEnd ? 'handleSpanEnd' : 'handleSpanUpdate';

    const spanData = this.getSpanData({ span, method });
    if (!spanData) {
      return;
    }

    const braintrustSpan = spanData.spans.get(span.id);
    if (!braintrustSpan) {
      this.logger.warn('Braintrust exporter: No Braintrust span found for span update/end', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        spanType: span.type,
        isRootSpan: span.isRootSpan,
        parentSpanId: span.parentSpanId,
        method,
      });
      return;
    }

    braintrustSpan.log(this.buildSpanPayload(span));

    if (isEnd) {
      // End the span with the correct endTime (convert milliseconds to seconds)
      if (span.endTime) {
        braintrustSpan.end({ endTime: span.endTime.getTime() / 1000 });
      } else {
        braintrustSpan.end();
      }

      // Refcount: mark this span as ended
      if (!span.isEvent) {
        spanData.activeIds.delete(span.id);
      }

      // If no more active spans remain for this trace, clean up the trace entry
      if (spanData.activeIds.size === 0) {
        this.traceMap.delete(span.traceId);
      }
    }
  }

  private async handleEventSpan(span: AnyExportedSpan): Promise<void> {
    if (span.isRootSpan) {
      this.logger.debug('Braintrust exporter: Creating logger for event', {
        traceId: span.traceId,
        spanId: span.id,
        spanName: span.name,
        method: 'handleEventSpan',
      });
      await this.initLogger(span);
    }

    const method = 'handleEventSpan';
    const spanData = this.getSpanData({ span, method });
    if (!spanData) {
      return;
    }

    const braintrustParent = this.getBraintrustParent({ spanData, span, method });
    if (!braintrustParent) {
      return;
    }

    const payload = this.buildSpanPayload(span);

    // Create zero-duration span for event (convert milliseconds to seconds)
    const braintrustSpan = braintrustParent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      parentSpanIds: span.parentSpanId
        ? { spanId: span.parentSpanId, rootSpanId: span.traceId }
        : { spanId: span.traceId, rootSpanId: span.traceId },
      startTime: span.startTime.getTime() / 1000,
      ...payload,
    });

    braintrustSpan.end({ endTime: span.startTime.getTime() / 1000 });
  }

  private async initLogger(span: AnyExportedSpan): Promise<void> {
    const logger = await initLogger({
      projectName: this.config.projectName ?? 'mastra-tracing',
      apiKey: this.config.apiKey,
      appUrl: this.config.endpoint,
      ...this.config.tuningParameters,
    });

    this.traceMap.set(span.traceId, { logger, spans: new Map(), activeIds: new Set() });
  }

  private getSpanData(options: { span: AnyExportedSpan; method: string }): SpanData | undefined {
    const { span, method } = options;
    if (this.traceMap.has(span.traceId)) {
      return this.traceMap.get(span.traceId);
    }

    this.logger.warn('Braintrust exporter: No span data found for span', {
      traceId: span.traceId,
      spanId: span.id,
      spanName: span.name,
      spanType: span.type,
      isRootSpan: span.isRootSpan,
      parentSpanId: span.parentSpanId,
      method,
    });
  }

  private getBraintrustParent(options: {
    spanData: SpanData;
    span: AnyExportedSpan;
    method: string;
  }): Logger<true> | Span | undefined {
    const { spanData, span, method } = options;

    const parentId = span.parentSpanId;
    if (!parentId) {
      return spanData.logger;
    }

    if (spanData.spans.has(parentId)) {
      return spanData.spans.get(parentId);
    }

    // If the parent exists but is the root span (not represented as a Braintrust
    // span because we use the logger as the root), attach to the logger so the
    // span is not orphaned. We need to check if parentSpanId exists but the
    // parent span is not in our spans map (indicating it's the root span).
    if (parentId && !spanData.spans.has(parentId)) {
      // This means the parent exists but isn't tracked as a Braintrust span,
      // which happens when the parent is the root span (we use logger as root)
      return spanData.logger;
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
  }

  private buildSpanPayload(span: AnyExportedSpan): Record<string, any> {
    const payload: Record<string, any> = {};

    // Core span data
    if (span.input !== undefined) {
      payload.input = span.input;
    }

    if (span.output !== undefined) {
      payload.output = span.output;
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
      payload.metrics = normalizeUsageMetrics(modelAttr);

      // Model parameters go to metadata
      if (modelAttr.parameters !== undefined) {
        payload.metadata.modelParameters = modelAttr.parameters;
      }

      // Other LLM attributes go to metadata
      const otherAttributes = omitKeys(attributes, ['model', 'usage', 'parameters']);
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
    if (!this.config) {
      return;
    }

    // End all active spans
    for (const [_traceId, spanData] of this.traceMap) {
      for (const [_spanId, span] of spanData.spans) {
        span.end();
      }
      // Loggers don't have an explicit shutdown method
    }
    this.traceMap.clear();
    await super.shutdown();
  }
}
