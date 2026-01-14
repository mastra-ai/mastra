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
type BraintrustSpan = Span;
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

  private startSpan(args: { parent: Span | Logger<true>; span: AnyExportedSpan }): Span {
    const { parent, span } = args;
    const payload = this.buildSpanPayload(span);
    return parent.startSpan({
      spanId: span.id,
      name: span.name,
      type: mapSpanType(span.type),
      startTime: span.startTime.getTime() / 1000,
      event: { id: span.id }, // Use Mastra span ID as Braintrust row ID for logFeedback() compatibility
      ...payload,
    });
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
  }): Promise<Span | undefined> {
    const { span, traceData } = args;

    if (span.isRootSpan) {
      const root = traceData.getRoot();
      if (root) {
        return this.startSpan({ parent: root, span });
      }
    } else {
      const parent = traceData.getParent(args);
      if (parent) {
        return this.startSpan({ parent, span });
      }
    }
  }

  protected override async _buildEvent(args: {
    span: AnyExportedSpan;
    traceData: BraintrustTraceData;
  }): Promise<Span | undefined> {
    const braintrustSpan = await this._buildSpan(args);

    if (!braintrustSpan) {
      // parent doesn't exist and not creating rootSpan, return early data
      return;
    }

    braintrustSpan.end({ endTime: args.span.startTime.getTime() / 1000 });
    return braintrustSpan;
  }

  protected override async _updateSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData }): Promise<void> {
    const { span, traceData } = args;

    const braintrustSpan = traceData.getSpan({ spanId: span.id });
    if (!braintrustSpan) {
      return;
    }
    braintrustSpan.log(this.buildSpanPayload(span, false));
  }

  protected override async _finishSpan(args: { span: AnyExportedSpan; traceData: BraintrustTraceData }): Promise<void> {
    const { span, traceData } = args;

    const braintrustSpan = traceData.getSpan({ spanId: span.id });
    if (!braintrustSpan) {
      return;
    }
    braintrustSpan.log(this.buildSpanPayload(span, false));

    if (span.endTime) {
      braintrustSpan.end({ endTime: span.endTime.getTime() / 1000 });
    } else {
      braintrustSpan.end();
    }
  }

  protected override async _abortSpan(args: { span: BraintrustSpan; reason: SpanErrorInfo }): Promise<void> {
    const { span, reason } = args;
    span.log({
      error: reason.message,
      metadata: { errorDetails: reason },
    });
    span.end();
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
      if (!output || typeof output !== 'object') {
        return output;
      }
      const { text, ...rest } = output;
      return { role: 'assistant', content: text, ...rest };
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

    return payload;
  }
}
