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
import { TrackingExporter } from '@mastra/observability';
import { initLogger, currentSpan } from 'braintrust';
import type { Span, Logger } from 'braintrust';
import { formatUsageMetrics } from './metrics';
import type { TraceData, TrackingExporterConfig } from '@mastra/observability';

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

type BraintrustMetadata = unknown;
type BraintrustTraceData = TraceData<Span, Span, Span, BraintrustMetadata>;

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

export class BraintrustExporter extends TrackingExporter<
  Span,
  Span,
  Span,
  BraintrustMetadata,
  BraintrustExporterConfig
> {
  name = 'braintrust';

  // Flags and logger for context-aware mode
  private useProvidedLogger: boolean;
  private providedLogger?: Logger<true>;
  private localLogger?: Logger<true>;

  constructor(config: BraintrustExporterConfig) {
    super(config);

    this.useProvidedLogger = !! config.braintrustLogger;

    if (this.useProvidedLogger) {
      // Use provided logger - enables Braintrust context integration
      this.providedLogger = config.braintrustLogger;
    } else {
      // Validate apiKey for creating loggers per trace
      if (!config.apiKey) {
        this.setDisabled(`Missing required credentials (apiKey: ${!!config.apiKey})`);
        return;
      }
      // lazy create logger on first rootSpan
      this.localLogger = undefined;
    }
  }

  private async _initLocalLogger () {
    try {
      const loggerInstance = await initLogger({
        projectName: this.config.projectName ?? 'mastra-tracing',
        apiKey: this.config.apiKey,
        appUrl: this.config.endpoint,
        ...this.config.tuningParameters,
      });
    } catch (err) {
      this.logger.error('Braintrust exporter: Failed to initialize logger', { error: err });
      this.setDisabled('Failed to initialize Braintrust logger');
    }
  }


  protected async _buildRoot(args: { span: AnyExportedSpan; traceData: BraintrustTraceData; }): Promise<Span | undefined> {
    const { span } = args;
    if (this.useProvidedLogger) {
      // Try to find a Braintrust span to attach to:
      // 1. Auto-detect from Braintrust's current span (logger.traced(), Eval(), etc.)
      // 2. Fall back to the configured logger
      const externalSpan = currentSpan();

      // Check if it's a valid span (not the NOOP_SPAN)
      if (externalSpan && externalSpan.id) {
        // External span detected - attach Mastra traces to it
        return this.startSpan({parent: externalSpan, span})
      } else {
        // No external span - use provided logger
        return this.startSpan({parent: this.providedLogger!, span})
      }
    } else { // Use the local logger
      if (!this.localLogger) {
        await this._initLocalLogger();
      }
      if (!this.isDisabled) {
        return this.startSpan({parent: this.localLogger!, span})
      }
    }
  }

  private startSpan(args: {parent: Span | Logger<true>, span: AnyExportedSpan}) : Span {
    const { parent, span } = args;
    const payload = this.buildSpanPayload(span);
    return parent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      startTime: span.startTime.getTime() / 1000,
      ...payload,
    });
  }

  protected async _buildEvent(args: { span: AnyExportedSpan; traceData: BraintrustTraceData; }): Promise<Span | undefined> {
    const { span, traceData } = args;

    const parent = traceData.getParent({span})
    if (!parent) {
      return;
    }

    const braintrustSpan = this.startSpan({parent, span})
    braintrustSpan.end({ endTime: span.startTime.getTime() / 1000 });

    return braintrustSpan;
  }

  protected async _buildSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData; }): Promise<Span | undefined> {
    const { span, traceData } = args;

    const parent = traceData.getParent({span})
    if (!parent) {
      return;
    }

    return this.startSpan({parent, span})
  }


  protected async _updateSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData; }): Promise<void> {
    const { span, traceData } = args;

    const braintrustSpan = traceData.getSpan({spanId: span.id});
    if (!braintrustSpan) {
      return
    }
    braintrustSpan.log(this.buildSpanPayload(span));
  }


  protected async _finishSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData; }): Promise<void> {
    const { span, traceData } = args;

    const braintrustSpan = traceData.getSpan({spanId: span.id});
    if (!braintrustSpan) {
      return
    }
    braintrustSpan.log(this.buildSpanPayload(span));

    if (span.endTime) {
      braintrustSpan.end({ endTime: span.endTime.getTime() / 1000 });
    } else {
      braintrustSpan.end();
    }
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

    if (span.isRootSpan && span.tags?.length) {
      payload.tags = span.tags;
    }

    // Initialize metrics and metadata objects
    payload.metrics = {};
    payload.metadata = {
      spanType: span.type,
      ...span.metadata,
      'mastra-trace-id': span.traceId,
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

  // async shutdown(): Promise<void> {
  //   if (!this.config) {
  //     return;
  //   }

  //   // End all active spans
  //   for (const [_traceId, spanData] of this.traceMap) {
  //     for (const [_spanId, span] of spanData.spans) {
  //       span.end();
  //     }
  //     // Loggers don't have an explicit shutdown method
  //   }
  //   this.traceMap.clear();
  //   await super.shutdown();
  // }
}
