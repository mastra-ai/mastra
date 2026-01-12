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
import { initLogger, currentSpan } from 'braintrust';
import type { Span, Logger } from 'braintrust';
import { formatUsageMetrics } from './metrics';

// ==============================================================================
// Type definitions for AI SDK message format conversion to OpenAI format
// ==============================================================================

/**
 * AI SDK content part types (both v4 and v5)
 */
interface AISDKTextPart {
  type: 'text';
  text: string;
}

interface AISDKImagePart {
  type: 'image';
  image?: string | Uint8Array | URL;
  mimeType?: string;
}

interface AISDKFilePart {
  type: 'file';
  data?: string | Uint8Array | URL;
  filename?: string;
  name?: string;
  mimeType?: string;
}

interface AISDKReasoningPart {
  type: 'reasoning';
  text?: string;
}

interface AISDKToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args?: unknown; // AI SDK v4
  input?: unknown; // AI SDK v5
}

interface AISDKToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  result?: unknown; // AI SDK v4
  output?: unknown; // AI SDK v5
}

type AISDKContentPart =
  | AISDKTextPart
  | AISDKImagePart
  | AISDKFilePart
  | AISDKReasoningPart
  | AISDKToolCallPart
  | AISDKToolResultPart
  | { type: string; [key: string]: unknown }; // Catch-all for unknown types

/**
 * AI SDK message format (input format for conversion)
 */
interface AISDKMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | AISDKContentPart[];
  [key: string]: unknown; // Allow additional properties
}

/**
 * OpenAI Chat Completion tool call format
 */
interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * OpenAI Chat Completion message format (output format)
 */
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  [key: string]: unknown; // Allow additional properties
}

const MASTRA_TRACE_ID_METADATA_KEY = 'mastra-trace-id';

export interface BraintrustExporterConfig extends BaseExporterConfig {
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

type SpanData = {
  logger: Logger<true> | Span; // Braintrust logger (for root spans) or external span
  spans: Map<string, Span>; // Maps span.id to Braintrust span
  activeIds: Set<string>; // Tracks started (non-event) spans not yet ended, including root
  isExternal: boolean; // True if logger is an external span from logger.traced() or Eval()
};

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

export class BraintrustExporter extends BaseExporter {
  name = 'braintrust';
  private traceMap = new Map<string, SpanData>();
  private config: BraintrustExporterConfig;

  // Flags and logger for context-aware mode
  private useProvidedLogger: boolean;
  private providedLogger?: Logger<true>;

  constructor(config: BraintrustExporterConfig = {}) {
    super(config);

    if (config.braintrustLogger) {
      // Use provided logger - enables Braintrust context integration
      this.useProvidedLogger = true;
      this.providedLogger = config.braintrustLogger;
      this.config = config;
    } else {
      // Read credentials from config or environment variables
      const apiKey = config.apiKey ?? process.env.BRAINTRUST_API_KEY;
      const endpoint = config.endpoint ?? process.env.BRAINTRUST_ENDPOINT;

      // Validate apiKey for creating loggers per trace
      if (!apiKey) {
        this.setDisabled(
          `Missing required API key. Set BRAINTRUST_API_KEY environment variable or pass apiKey in config.`,
        );
        this.config = null as any;
        this.useProvidedLogger = false;
        return;
      }
      this.useProvidedLogger = false;
      this.config = {
        ...config,
        apiKey,
        endpoint,
      };
    }
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
      if (this.useProvidedLogger) {
        // Use provided logger, detect external Braintrust spans
        await this.initLoggerOrUseContext(span);
      } else {
        // Create new logger per trace
        await this.initLoggerPerTrace(span);
      }
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
      // Don't clean up if using external spans (they're managed by Braintrust)
      if (spanData.activeIds.size === 0 && !spanData.isExternal) {
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

      if (this.useProvidedLogger) {
        // Use provided logger, detect external Braintrust spans
        await this.initLoggerOrUseContext(span);
      } else {
        // Create new logger per trace
        await this.initLoggerPerTrace(span);
      }
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
      startTime: span.startTime.getTime() / 1000,
      ...payload,
    });

    braintrustSpan.end({ endTime: span.startTime.getTime() / 1000 });
  }

  private initTraceMap(params: { traceId: string; isExternal: boolean; logger: Logger<true> | Span }): void {
    const { traceId, isExternal, logger } = params;

    // Check if trace already exists - reuse existing trace data
    if (this.traceMap.has(traceId)) {
      this.logger.debug('Braintrust exporter: Reusing existing trace from local map', { traceId });
      return;
    }

    this.traceMap.set(traceId, {
      logger,
      spans: new Map(),
      activeIds: new Set(),
      isExternal,
    });
  }

  /**
   * Creates a new logger per trace using config credentials
   */
  private async initLoggerPerTrace(span: AnyExportedSpan): Promise<void> {
    // Check if trace already exists - reuse existing trace data
    if (this.traceMap.has(span.traceId)) {
      this.logger.debug('Braintrust exporter: Reusing existing trace from local map', { traceId: span.traceId });
      return;
    }

    // Guard against null config (when exporter is disabled)
    if (!this.config) {
      return;
    }

    try {
      const loggerInstance = await initLogger({
        projectName: this.config.projectName ?? 'mastra-tracing',
        apiKey: this.config.apiKey,
        appUrl: this.config.endpoint,
        ...this.config.tuningParameters,
      });

      this.initTraceMap({ logger: loggerInstance, isExternal: false, traceId: span.traceId });
    } catch (err) {
      this.logger.error('Braintrust exporter: Failed to initialize logger', { error: err, traceId: span.traceId });
      this.setDisabled('Failed to initialize Braintrust logger');
    }
  }

  /**
   * Uses provided logger and detects external Braintrust spans.
   * If a Braintrust span is detected (from logger.traced() or Eval()), attaches to it.
   * Otherwise, uses the provided logger instance.
   */
  private async initLoggerOrUseContext(span: AnyExportedSpan): Promise<void> {
    // Check if trace already exists - reuse existing trace data
    if (this.traceMap.has(span.traceId)) {
      this.logger.debug('Braintrust exporter: Reusing existing trace from local map', { traceId: span.traceId });
      return;
    }

    // Try to find a Braintrust span to attach to:
    // 1. Auto-detect from Braintrust's current span (logger.traced(), Eval(), etc.)
    // 2. Fall back to the configured logger
    const braintrustSpan = currentSpan();

    // Check if it's a valid span (not the NOOP_SPAN)
    if (braintrustSpan && braintrustSpan.id) {
      // External span detected - attach Mastra traces to it
      this.initTraceMap({ logger: braintrustSpan, isExternal: true, traceId: span.traceId });
    } else {
      // No external span - use provided logger
      this.initTraceMap({ logger: this.providedLogger!, isExternal: false, traceId: span.traceId });
    }
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

  /**
   * Converts AI SDK message format to OpenAI Chat Completion format for Braintrust.
   *
   * Supports both AI SDK v4 and v5 formats:
   *   - v4 uses 'args' for tool calls and 'result' for tool results
   *   - v5 uses 'input' for tool calls and 'output' for tool results
   *
   * AI SDK format:
   *   { role: "user", content: [{ type: "text", text: "hello" }] }
   *   { role: "assistant", content: [{ type: "text", text: "..." }, { type: "tool-call", toolCallId: "...", toolName: "...", args: {...} }] }
   *   { role: "tool", content: [{ type: "tool-result", toolCallId: "...", result: {...} }] }
   *
   * OpenAI format (what Braintrust expects):
   *   { role: "user", content: "hello" }
   *   { role: "assistant", content: "...", tool_calls: [{ id: "...", type: "function", function: { name: "...", arguments: "..." } }] }
   *   { role: "tool", content: "result", tool_call_id: "..." }
   */
  private convertAISDKMessage(message: AISDKMessage | OpenAIMessage | unknown): OpenAIMessage | unknown {
    if (!message || typeof message !== 'object') {
      return message;
    }

    const { role, content, ...rest } = message as AISDKMessage;

    // If content is already a string, return as-is (already in OpenAI format)
    if (typeof content === 'string') {
      return message;
    }

    // If content is an array (AI SDK format), convert based on role
    if (Array.isArray(content)) {
      // Handle empty content arrays
      if (content.length === 0) {
        return { role, content: '', ...rest };
      }

      // For user/system messages, extract text and represent non-text content
      if (role === 'user' || role === 'system') {
        const contentParts = content.map((part: any) => this.convertContentPart(part)).filter(Boolean);

        return {
          role,
          content: contentParts.length > 0 ? contentParts.join('\n') : '',
          ...rest,
        };
      }

      // For assistant messages, extract text, non-text content, AND tool calls
      if (role === 'assistant') {
        const contentParts = content
          .filter((part: any) => part?.type !== 'tool-call')
          .map((part: any) => this.convertContentPart(part))
          .filter(Boolean);

        const toolCallParts = content.filter((part: any) => part?.type === 'tool-call');

        const result: any = {
          role,
          content: contentParts.length > 0 ? contentParts.join('\n') : '',
          ...rest,
        };

        // Add tool_calls array if there are tool calls
        if (toolCallParts.length > 0) {
          result.tool_calls = toolCallParts.map((tc: any) => {
            const toolCallId = tc.toolCallId;
            const toolName = tc.toolName;
            // Support both v4 'args' and v5 'input'
            const args = tc.args ?? tc.input;

            let argsString: string;
            if (typeof args === 'string') {
              argsString = args;
            } else if (args !== undefined && args !== null) {
              argsString = JSON.stringify(args);
            } else {
              argsString = '{}';
            }

            return {
              id: toolCallId,
              type: 'function',
              function: {
                name: toolName,
                arguments: argsString,
              },
            };
          });
        }

        return result;
      }

      // For tool messages, convert to OpenAI tool message format
      if (role === 'tool') {
        const toolResult = content.find((part): part is AISDKToolResultPart => part?.type === 'tool-result');
        if (toolResult) {
          // Support both v4 'result' and v5 'output' fields
          const resultData = toolResult.output ?? toolResult.result;
          const resultContent = this.serializeToolResult(resultData);

          return {
            role: 'tool',
            content: resultContent,
            tool_call_id: toolResult.toolCallId,
          } as OpenAIMessage;
        }
      }
    }

    return message;
  }

  /**
   * Converts a content part to a string representation.
   * Handles text, image, file, reasoning, and other content types.
   */
  private convertContentPart(part: AISDKContentPart | null | undefined): string | null {
    if (!part || typeof part !== 'object') {
      return null;
    }

    switch (part.type) {
      case 'text':
        return (part as AISDKTextPart).text || null;

      case 'image':
        // Represent image content with a placeholder
        return '[image]';

      case 'file': {
        // Represent file content with filename if available
        const filePart = part as AISDKFilePart;
        if (filePart.filename || filePart.name) {
          return `[file: ${filePart.filename || filePart.name}]`;
        }
        return '[file]';
      }

      case 'reasoning': {
        // Represent reasoning/thinking content
        const reasoningPart = part as AISDKReasoningPart;
        if (typeof reasoningPart.text === 'string' && reasoningPart.text.length > 0) {
          return `[reasoning: ${reasoningPart.text.substring(0, 100)}${reasoningPart.text.length > 100 ? '...' : ''}]`;
        }
        return '[reasoning]';
      }

      case 'tool-call':
        // Tool calls are handled separately in assistant messages
        return null;

      case 'tool-result':
        // Tool results are handled separately in tool messages
        return null;

      default: {
        // For unknown types, try to extract any text-like content
        const unknownPart = part as { type?: string; text?: string; content?: string };
        if (typeof unknownPart.text === 'string') {
          return unknownPart.text;
        }
        if (typeof unknownPart.content === 'string') {
          return unknownPart.content;
        }
        // Represent unknown content type
        return `[${unknownPart.type || 'unknown'}]`;
      }
    }
  }

  /**
   * Serializes tool result data to a string for OpenAI format.
   */
  private serializeToolResult(resultData: any): string {
    if (typeof resultData === 'string') {
      return resultData;
    }
    if (resultData && typeof resultData === 'object' && 'value' in resultData) {
      return typeof resultData.value === 'string' ? resultData.value : JSON.stringify(resultData.value);
    }
    if (resultData === undefined || resultData === null) {
      return '';
    }
    try {
      return JSON.stringify(resultData);
    } catch {
      return '[unserializable result]';
    }
  }

  /**
   * Transforms MODEL_GENERATION input to Braintrust Thread view format.
   * Converts AI SDK messages (v4/v5) to OpenAI Chat Completion format, which Braintrust requires
   * for proper rendering of threads (fixes #11023).
   */
  private transformInput(input: any, spanType: SpanType): any {
    if (spanType === SpanType.MODEL_GENERATION) {
      // If input is already an array of messages, convert AI SDK format to OpenAI format
      if (Array.isArray(input)) {
        return input.map((msg: AISDKMessage) => this.convertAISDKMessage(msg));
      }

      // If input has a messages array
      if (input && Array.isArray(input.messages)) {
        return input.messages.map((msg: AISDKMessage) => this.convertAISDKMessage(msg));
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
