/**
 * Braintrust Exporter for Mastra Observability
 *
 * This exporter sends observability data to Braintrust.
 * Root spans become top-level Braintrust spans (no trace wrapper).
 * Events are handled as zero-duration spans with matching start/end times.
 */

import type { AnyExportedSpan, ModelGenerationAttributes, SpanErrorInfo } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { omitKeys } from '@mastra/core/utils';
import { TrackingExporter } from '@mastra/observability';
import type { TraceData, TrackingExporterConfig } from '@mastra/observability';
import { initLogger, currentSpan } from 'braintrust';
import type { Span, Logger } from 'braintrust';
import { removeNullish, convertAISDKMessage } from './formatter';
import { formatUsageMetrics } from './metrics';
import { reconstructThreadOutput } from './thread-reconstruction';
import type { ThreadData, ThreadStepData, PendingToolResult } from './thread-reconstruction';

/**
 * Extended Braintrust span data that includes span type and thread reconstruction data
 */
interface BraintrustSpanData {
  span: Span;
  spanType: SpanType;
  threadData?: ThreadData; // only populated for MODEL_GENERATION spans
  // Tool results stored when TOOL_CALL ends (may arrive before MODEL_STEP ends)
  pendingToolResults?: Map<string, PendingToolResult>; // keyed by toolCallId
}

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

type BraintrustRoot = Logger<true> | Span;
type BraintrustSpan = BraintrustSpanData;
type BraintrustEvent = Span;
type BraintrustMetadata = unknown;
type BraintrustTraceData = TraceData<BraintrustRoot, BraintrustSpan, BraintrustEvent, BraintrustMetadata>;

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
  BraintrustRoot,
  BraintrustSpan,
  BraintrustEvent,
  BraintrustMetadata,
  BraintrustExporterConfig
> {
  name = 'braintrust';

  // Flags and logger for context-aware mode
  #useProvidedLogger: boolean;
  #providedLogger?: Logger<true>;
  #localLogger?: Logger<true>;

  constructor(config: BraintrustExporterConfig = {}) {
    // Resolve env vars BEFORE calling super (config is readonly in base class)
    const resolvedApiKey = config.apiKey ?? process.env.BRAINTRUST_API_KEY;
    const resolvedEndpoint = config.endpoint ?? process.env.BRAINTRUST_ENDPOINT;

    super({
      ...config,
      apiKey: resolvedApiKey,
      endpoint: resolvedEndpoint,
    });

    this.#useProvidedLogger = !!config.braintrustLogger;

    if (this.#useProvidedLogger) {
      // Use provided logger - enables Braintrust context integration
      this.#providedLogger = config.braintrustLogger;
    } else {
      // Validate apiKey for creating loggers per trace
      if (!this.config.apiKey) {
        this.setDisabled(
          `Missing required API key. Set BRAINTRUST_API_KEY environment variable or pass apiKey in config.`,
        );
        return;
      }
      // lazy create logger on first rootSpan
      this.#localLogger = undefined;
    }
  }

  private async getLocalLogger(): Promise<Logger<true> | undefined> {
    if (this.#localLogger) {
      return this.#localLogger;
    }
    try {
      const logger = await initLogger({
        projectName: this.config.projectName ?? 'mastra-tracing',
        apiKey: this.config.apiKey,
        appUrl: this.config.endpoint,
        ...this.config.tuningParameters,
      });
      this.#localLogger = logger;
      return logger;
    } catch (err) {
      this.logger.error('Braintrust exporter: Failed to initialize logger', { error: err });
      this.setDisabled('Failed to initialize Braintrust logger');
    }
  }

  private startSpan(args: { parent: Span | Logger<true>; span: AnyExportedSpan }): BraintrustSpanData {
    const { parent, span } = args;
    const payload = this.buildSpanPayload(span);
    const braintrustSpan = parent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      startTime: span.startTime.getTime() / 1000,
      event: { id: span.id }, // Use Mastra span ID as Braintrust row ID for logFeedback() compatibility
      ...payload,
    });

    // Create BraintrustSpanData with span type for tree walking
    // Initialize threadData and pendingToolResults for MODEL_GENERATION spans (used for Thread view reconstruction)
    const isModelGeneration = span.type === SpanType.MODEL_GENERATION;
    return {
      span: braintrustSpan,
      spanType: span.type,
      threadData: isModelGeneration ? [] : undefined,
      pendingToolResults: isModelGeneration ? new Map() : undefined,
    };
  }

  protected override async _buildRoot(_args: {
    span: AnyExportedSpan;
    traceData: BraintrustTraceData;
  }): Promise<BraintrustRoot | undefined> {
    if (this.#useProvidedLogger) {
      // Try to find a Braintrust span to attach to:
      // 1. Auto-detect from Braintrust's current span (logger.traced(), Eval(), etc.)
      // 2. Fall back to the configured logger
      const externalSpan = currentSpan();

      // Check if it's a valid span (not the NOOP_SPAN)
      if (externalSpan && externalSpan.id) {
        // External span detected - attach Mastra traces to it
        return externalSpan;
      } else {
        // No external span - use provided logger
        return this.#providedLogger!;
      }
    } else {
      // Use the local logger
      return this.getLocalLogger();
    }
  }

  protected override async _buildSpan(args: {
    span: AnyExportedSpan;
    traceData: BraintrustTraceData;
  }): Promise<BraintrustSpanData | undefined> {
    const { span, traceData } = args;

    if (span.isRootSpan) {
      const root = traceData.getRoot();
      if (root) {
        return this.startSpan({ parent: root, span });
      }
    } else {
      const parent = traceData.getParent(args);
      if (parent) {
        // Parent could be BraintrustSpanData (has .span) or BraintrustRoot (Logger/Span, no .span)
        const parentSpan = 'span' in parent ? parent.span : parent;
        return this.startSpan({ parent: parentSpan, span });
      }
    }
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: BraintrustTraceData;
  }): Promise<Span | undefined> {
    const spanData = await this._buildSpan(args);

    if (!spanData) {
      // parent doesn't exist and not creating rootSpan, return early data
      return;
    }

    spanData.span.end({ endTime: args.span.startTime.getTime() / 1000 });
    return spanData.span;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData }): Promise<void> {
    const { span, traceData } = args;

    const spanData = traceData.getSpan({ spanId: span.id });
    if (!spanData) {
      return;
    }
    spanData.span.log(this.buildSpanPayload(span, false));
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData }): Promise<void> {
    const { span, traceData } = args;

    const spanData = traceData.getSpan({ spanId: span.id });
    if (!spanData) {
      return;
    }

    // Handle thread data accumulation for MODEL_STEP and TOOL_CALL spans
    if (span.type === SpanType.MODEL_STEP) {
      this.accumulateModelStepData(span, traceData);
    } else if (span.type === SpanType.TOOL_CALL) {
      this.accumulateToolCallResult(span, traceData);
    }

    // Build payload - for MODEL_GENERATION, may reconstruct output from threadData
    const payload =
      span.type === SpanType.MODEL_GENERATION
        ? this.buildModelGenerationPayload(span, spanData)
        : this.buildSpanPayload(span, false);

    spanData.span.log(payload);

    if (span.endTime) {
      spanData.span.end({ endTime: span.endTime.getTime() / 1000 });
    } else {
      spanData.span.end();
    }
  }

  protected override async _abortSpan(args: { span: BraintrustSpan; reason: SpanErrorInfo }): Promise<void> {
    const { span: spanData, reason } = args;
    spanData.span.log({
      error: reason.message,
      metadata: { errorDetails: reason },
    });
    spanData.span.end();
  }

  // ==============================================================================
  // Thread view reconstruction helpers
  // ==============================================================================

  /**
   * Walk up the tree to find the MODEL_GENERATION ancestor span.
   * Returns the BraintrustSpanData if found, undefined otherwise.
   */
  private findModelGenerationAncestor(spanId: string, traceData: BraintrustTraceData): BraintrustSpanData | undefined {
    let currentId: string | undefined = spanId;

    while (currentId) {
      const parentId = traceData.getParentId({ spanId: currentId });
      if (!parentId) return undefined;

      const parentSpanData = traceData.getSpan({ spanId: parentId });
      if (parentSpanData?.spanType === SpanType.MODEL_GENERATION) {
        return parentSpanData;
      }
      currentId = parentId;
    }

    return undefined;
  }

  /**
   * Accumulate MODEL_STEP data to the parent MODEL_GENERATION's threadData.
   * Called when a MODEL_STEP span ends.
   */
  private accumulateModelStepData(span: AnyExportedSpan, traceData: BraintrustTraceData): void {
    const modelGenSpanData = this.findModelGenerationAncestor(span.id, traceData);
    if (!modelGenSpanData?.threadData) {
      return;
    }

    // Extract step data from MODEL_STEP output and attributes
    const output = span.output as
      | { text?: string; toolCalls?: Array<{ toolCallId: string; toolName: string; args: unknown }> }
      | undefined;
    const attributes = span.attributes as { stepIndex?: number } | undefined;

    const stepData: ThreadStepData = {
      stepSpanId: span.id,
      stepIndex: attributes?.stepIndex ?? 0,
      text: output?.text,
      toolCalls: output?.toolCalls?.map(tc => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.args,
      })),
    };

    modelGenSpanData.threadData.push(stepData);
  }

  /**
   * Store TOOL_CALL result in parent MODEL_GENERATION's pendingToolResults.
   * Called when a TOOL_CALL span ends.
   * Results are merged into threadData when MODEL_GENERATION ends.
   */
  private accumulateToolCallResult(span: AnyExportedSpan, traceData: BraintrustTraceData): void {
    const modelGenSpanData = this.findModelGenerationAncestor(span.id, traceData);
    if (!modelGenSpanData?.pendingToolResults) {
      return;
    }

    // Extract tool call ID from TOOL_CALL span input
    const input = span.input as { toolCallId?: string } | undefined;
    const toolCallId = input?.toolCallId;
    if (!toolCallId) {
      return;
    }

    // Store the result for later merging
    modelGenSpanData.pendingToolResults.set(toolCallId, {
      result: span.output,
      startTime: span.startTime,
    });
  }

  /**
   * Build the payload for MODEL_GENERATION span, reconstructing output from threadData if available.
   */
  private buildModelGenerationPayload(span: AnyExportedSpan, spanData: BraintrustSpanData): Record<string, any> {
    const basePayload = this.buildSpanPayload(span, false);

    // Check if we have threadData with tool calls to reconstruct
    const threadData = spanData.threadData;
    if (!threadData || threadData.length === 0) {
      return basePayload;
    }

    // Merge pending tool results into threadData
    if (spanData.pendingToolResults && spanData.pendingToolResults.size > 0) {
      for (const step of threadData) {
        if (step.toolCalls) {
          for (const toolCall of step.toolCalls) {
            const pendingResult = spanData.pendingToolResults.get(toolCall.toolCallId);
            if (pendingResult) {
              toolCall.result = pendingResult.result;
              toolCall.startTime = pendingResult.startTime;
            }
          }
        }
      }
    }

    // Check if any step has tool calls
    const hasToolCalls = threadData.some(step => step.toolCalls && step.toolCalls.length > 0);
    if (!hasToolCalls) {
      return basePayload;
    }

    // Reconstruct output as OpenAI messages
    const reconstructedOutput = reconstructThreadOutput(threadData, span.output);
    return {
      ...basePayload,
      output: reconstructedOutput,
    };
  }

  /**
   * Transforms MODEL_GENERATION input to Braintrust Thread view format.
   * Converts AI SDK messages (v4/v5) to OpenAI Chat Completion format, which Braintrust requires
   * for proper rendering of threads (fixes #11023).
   */
  private transformInput(input: unknown, spanType: SpanType): unknown {
    if (spanType === SpanType.MODEL_GENERATION) {
      // If input is already an array of messages, convert AI SDK format to OpenAI format
      if (Array.isArray(input)) {
        return input.map((msg: unknown) => convertAISDKMessage(msg));
      }

      // If input has a messages array
      if (
        input &&
        typeof input === 'object' &&
        'messages' in input &&
        Array.isArray((input as { messages: unknown[] }).messages)
      ) {
        return (input as { messages: unknown[] }).messages.map((msg: unknown) => convertAISDKMessage(msg));
      }
    }

    return input;
  }

  /**
   * Transforms MODEL_GENERATION output to Braintrust Thread view format.
   */
  private transformOutput(output: any, spanType: SpanType): any {
    if (spanType === SpanType.MODEL_GENERATION) {
      if (!output || typeof output !== 'object') {
        return output;
      }
      const { text, ...rest } = output;
      // Remove null/undefined values from rest to keep Thread view clean
      return { role: 'assistant', content: text, ...removeNullish(rest) };
    }

    return output;
  }

  private buildSpanPayload(span: AnyExportedSpan, isCreate = true): Record<string, any> {
    const payload: Record<string, any> = {};

    if (span.input !== undefined) {
      payload.input = this.transformInput(span.input, span.type);
    }

    if (span.output !== undefined) {
      payload.output = this.transformOutput(span.output, span.type);
    }

    if (isCreate && span.isRootSpan && span.tags?.length) {
      payload.tags = span.tags;
    }

    // Initialize metrics and metadata objects
    payload.metrics = {};
    // Spread span.metadata first, then set spanType to prevent accidental override
    payload.metadata = {
      ...span.metadata,
      spanType: span.type,
    };

    if (isCreate) {
      payload.metadata['mastra-trace-id'] = span.traceId;
    }

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

    // Remove null/undefined values from metadata to keep Braintrust UI clean
    payload.metadata = removeNullish(payload.metadata);

    return payload;
  }
}
