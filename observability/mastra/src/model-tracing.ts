/**
 * Model Span Tracing
 *
 * Provides span tracking for Model generations, including:
 * - MODEL_STEP spans (one per Model API call)
 * - MODEL_CHUNK spans (individual streaming chunks within a step)
 *
 * Hierarchy: MODEL_GENERATION -> MODEL_STEP -> MODEL_CHUNK
 */

import { TransformStream } from 'node:stream/web';
import { SpanType } from '@mastra/core/observability';
import type {
  Span,
  EndGenerationOptions,
  ErrorSpanOptions,
  TracingContext,
  UpdateSpanOptions,
} from '@mastra/core/observability';
import type { ChunkType, StepStartPayload, StepFinishPayload } from '@mastra/core/stream';

import { extractUsageMetrics } from './usage';

/**
 * Manages MODEL_STEP and MODEL_CHUNK span tracking for streaming Model responses.
 *
 * Should be instantiated once per MODEL_GENERATION span and shared across
 * all streaming steps (including after tool calls).
 */
/**
 * Tracks accumulated content for a single tool output stream
 */
interface ToolOutputAccumulator {
  toolName: string;
  toolCallId: string;
  text: string;
  reasoning: string;
  span?: Span<SpanType.MODEL_CHUNK>;
  sequenceNumber: number;
}

export class ModelSpanTracker {
  #modelSpan?: Span<SpanType.MODEL_GENERATION>;
  #currentStepSpan?: Span<SpanType.MODEL_STEP>;
  #currentChunkSpan?: Span<SpanType.MODEL_CHUNK>;
  #accumulator: Record<string, any> = {};
  #stepIndex: number = 0;
  #chunkSequence: number = 0;
  #completionStartTime?: Date;
  /** Tracks tool output accumulators by toolCallId for consolidating sub-agent streams */
  #toolOutputAccumulators: Map<string, ToolOutputAccumulator> = new Map();
  /** Tracks toolCallIds that had streaming output (to skip redundant tool-result spans) */
  #streamedToolCallIds: Set<string> = new Set();

  constructor(modelSpan?: Span<SpanType.MODEL_GENERATION>) {
    this.#modelSpan = modelSpan;
  }

  /**
   * Capture the completion start time (time to first token) when the first content chunk arrives.
   */
  #captureCompletionStartTime(): void {
    if (this.#completionStartTime) {
      return;
    }
    this.#completionStartTime = new Date();
  }

  /**
   * Get the tracing context for creating child spans.
   * Returns the current step span if active, otherwise the model span.
   */
  getTracingContext(): TracingContext {
    return {
      currentSpan: this.#currentStepSpan ?? this.#modelSpan,
    };
  }

  /**
   * Report an error on the generation span
   */
  reportGenerationError(options: ErrorSpanOptions<SpanType.MODEL_GENERATION>): void {
    this.#modelSpan?.error(options);
  }

  /**
   * End the generation span with optional raw usage data.
   * If usage is provided, it will be converted to UsageStats with cache token details.
   */
  endGeneration(options?: EndGenerationOptions): void {
    const { usage, providerMetadata, ...spanOptions } = options ?? {};

    if (spanOptions.attributes) {
      spanOptions.attributes.completionStartTime = this.#completionStartTime;
      spanOptions.attributes.usage = extractUsageMetrics(usage, providerMetadata);
    }

    this.#modelSpan?.end(spanOptions);
  }

  /**
   * Update the generation span
   */
  updateGeneration(options: UpdateSpanOptions<SpanType.MODEL_GENERATION>): void {
    this.#modelSpan?.update(options);
  }

  /**
   * Start a new Model execution step.
   * This should be called at the beginning of LLM execution to capture accurate startTime.
   * The step-start chunk payload can be passed later via updateStep() if needed.
   */
  startStep(payload?: StepStartPayload): void {
    // Don't create duplicate step spans
    if (this.#currentStepSpan) {
      return;
    }

    this.#currentStepSpan = this.#modelSpan?.createChildSpan({
      name: `step: ${this.#stepIndex}`,
      type: SpanType.MODEL_STEP,
      attributes: {
        stepIndex: this.#stepIndex,
        ...(payload?.messageId ? { messageId: payload.messageId } : {}),
        ...(payload?.warnings?.length ? { warnings: payload.warnings } : {}),
      },
      input: payload?.request,
    });
    // Reset chunk sequence for new step
    this.#chunkSequence = 0;
  }

  /**
   * Update the current step span with additional payload data.
   * Called when step-start chunk arrives with request/warnings info.
   */
  updateStep(payload?: StepStartPayload): void {
    if (!this.#currentStepSpan || !payload) {
      return;
    }

    // Update span with request/warnings from the step-start chunk
    this.#currentStepSpan.update({
      input: payload.request,
      attributes: {
        ...(payload.messageId ? { messageId: payload.messageId } : {}),
        ...(payload.warnings?.length ? { warnings: payload.warnings } : {}),
      },
    });
  }

  /**
   * End the current Model execution step with token usage, finish reason, output, and metadata
   */
  #endStepSpan<OUTPUT>(payload: StepFinishPayload<any, OUTPUT>) {
    if (!this.#currentStepSpan) return;

    // Extract all data from step-finish chunk
    const output = payload.output;
    const { usage: rawUsage, ...otherOutput } = output;
    const stepResult = payload.stepResult;
    const metadata = payload.metadata;

    // Convert raw usage to UsageStats with cache token details
    const usage = extractUsageMetrics(rawUsage, metadata?.providerMetadata);

    // Remove request object from metadata (too verbose)
    const cleanMetadata = metadata ? { ...metadata } : undefined;
    if (cleanMetadata?.request) {
      delete cleanMetadata.request;
    }

    this.#currentStepSpan.end({
      output: otherOutput,
      attributes: {
        usage,
        isContinued: stepResult.isContinued,
        finishReason: stepResult.reason,
        warnings: stepResult.warnings,
      },
      metadata: {
        ...cleanMetadata,
      },
    });
    this.#currentStepSpan = undefined;
    this.#stepIndex++;
  }

  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  #startChunkSpan(chunkType: string, initialData?: Record<string, any>) {
    // Auto-create step if we see a chunk before step-start
    if (!this.#currentStepSpan) {
      this.startStep();
    }

    this.#currentChunkSpan = this.#currentStepSpan?.createChildSpan({
      name: `chunk: '${chunkType}'`,
      type: SpanType.MODEL_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.#chunkSequence,
      },
    });
    this.#accumulator = initialData || {};
  }

  /**
   * Append string content to a specific field in the accumulator
   */
  #appendToAccumulator(field: string, text: string) {
    if (this.#accumulator[field] === undefined) {
      this.#accumulator[field] = text;
    } else {
      this.#accumulator[field] += text;
    }
  }

  /**
   * End the current chunk span.
   * Safe to call multiple times - will no-op if span already ended.
   */
  #endChunkSpan(output?: any) {
    if (!this.#currentChunkSpan) return;

    this.#currentChunkSpan.end({
      output: output !== undefined ? output : this.#accumulator,
    });
    this.#currentChunkSpan = undefined;
    this.#accumulator = {};
    this.#chunkSequence++;
  }

  /**
   * Create an event span (for single chunks like tool-call)
   */
  #createEventSpan(chunkType: string, output: any) {
    // Auto-create step if we see a chunk before step-start
    if (!this.#currentStepSpan) {
      this.startStep();
    }

    const span = this.#currentStepSpan?.createEventSpan({
      name: `chunk: '${chunkType}'`,
      type: SpanType.MODEL_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.#chunkSequence,
      },
      output,
    });

    if (span) {
      this.#chunkSequence++;
    }
  }

  /**
   * Check if there is currently an active chunk span
   */
  #hasActiveChunkSpan(): boolean {
    return !!this.#currentChunkSpan;
  }

  /**
   * Get the current accumulator value
   */
  #getAccumulator(): Record<string, any> {
    return this.#accumulator;
  }

  /**
   * Handle text chunk spans (text-start/delta/end)
   */
  #handleTextChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'text-start':
        this.#startChunkSpan('text');
        break;

      case 'text-delta':
        this.#appendToAccumulator('text', chunk.payload.text);
        break;

      case 'text-end': {
        this.#endChunkSpan();
        break;
      }
    }
  }

  /**
   * Handle reasoning chunk spans (reasoning-start/delta/end)
   */
  #handleReasoningChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'reasoning-start':
        this.#startChunkSpan('reasoning');
        break;

      case 'reasoning-delta':
        this.#appendToAccumulator('text', chunk.payload.text);
        break;

      case 'reasoning-end': {
        this.#endChunkSpan();
        break;
      }
    }
  }

  /**
   * Handle tool call chunk spans (tool-call-input-streaming-start/delta/end, tool-call)
   */
  #handleToolCallChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'tool-call-input-streaming-start':
        this.#startChunkSpan('tool-call', {
          toolName: chunk.payload.toolName,
          toolCallId: chunk.payload.toolCallId,
        });
        break;

      case 'tool-call-delta':
        this.#appendToAccumulator('toolInput', chunk.payload.argsTextDelta);
        break;

      case 'tool-call-input-streaming-end':
      case 'tool-call': {
        // Build output with toolName, toolCallId, and parsed toolInput
        const acc = this.#getAccumulator();
        let toolInput;
        try {
          toolInput = acc.toolInput ? JSON.parse(acc.toolInput) : {};
        } catch {
          toolInput = acc.toolInput; // Keep as string if parsing fails
        }
        this.#endChunkSpan({
          toolName: acc.toolName,
          toolCallId: acc.toolCallId,
          toolInput,
        });
        break;
      }
    }
  }

  /**
   * Handle object chunk spans (object, object-result)
   */
  #handleObjectChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    switch (chunk.type) {
      case 'object':
        // Start span on first partial object chunk (only if not already started)
        // Multiple object chunks may arrive as the object is being generated
        if (!this.#hasActiveChunkSpan()) {
          this.#startChunkSpan('object');
        }
        break;

      case 'object-result':
        // End the span with the final complete object as output
        this.#endChunkSpan(chunk.object);
        break;
    }
  }

  /**
   * Handle tool-call-approval chunks.
   * Creates a span for approval requests so they can be seen in traces for debugging.
   */
  #handleToolApprovalChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    if (chunk.type !== 'tool-call-approval') return;

    const payload = chunk.payload as {
      toolCallId: string;
      toolName: string;
      args: Record<string, any>;
      resumeSchema: string;
    };

    // Auto-create step if we see a chunk before step-start
    if (!this.#currentStepSpan) {
      this.startStep();
    }

    // Create an event span for the approval request
    // Using createEventSpan since approvals are point-in-time events (not time ranges)
    const span = this.#currentStepSpan?.createEventSpan({
      name: `chunk: 'tool-call-approval'`,
      type: SpanType.MODEL_CHUNK,
      attributes: {
        chunkType: 'tool-call-approval',
        sequenceNumber: this.#chunkSequence,
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
      },
      output: {
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        args: payload.args,
        resumeSchema: payload.resumeSchema,
      },
    });

    if (span) {
      this.#chunkSequence++;
    }
  }

  /**
   * Handle tool-output chunks from sub-agents.
   * Consolidates streaming text/reasoning deltas into a single span per tool call.
   */
  #handleToolOutputChunk<OUTPUT>(chunk: ChunkType<OUTPUT>) {
    if (chunk.type !== 'tool-output') return;

    const payload = chunk.payload as {
      output: any;
      toolCallId: string;
      toolName?: string;
    };

    const { output, toolCallId, toolName } = payload;

    // Get or create accumulator for this tool call
    let acc = this.#toolOutputAccumulators.get(toolCallId);
    if (!acc) {
      // Auto-create step if we see a chunk before step-start
      if (!this.#currentStepSpan) {
        this.startStep();
      }

      acc = {
        toolName: toolName || 'unknown',
        toolCallId,
        text: '',
        reasoning: '',
        sequenceNumber: this.#chunkSequence++,
        // Name the span 'tool-result' for consistency (tool-call → tool-result)
        span: this.#currentStepSpan?.createChildSpan({
          name: `chunk: 'tool-result'`,
          type: SpanType.MODEL_CHUNK,
          attributes: {
            chunkType: 'tool-result',
            sequenceNumber: this.#chunkSequence - 1,
          },
        }),
      };
      this.#toolOutputAccumulators.set(toolCallId, acc);
    }

    // Handle the inner chunk based on its type
    if (output && typeof output === 'object' && 'type' in output) {
      const innerType = output.type as string;

      switch (innerType) {
        case 'text-delta':
          // Accumulate text content
          if (output.payload?.text) {
            acc.text += output.payload.text;
          }
          break;

        case 'reasoning-delta':
          // Accumulate reasoning content
          if (output.payload?.text) {
            acc.reasoning += output.payload.text;
          }
          break;

        case 'finish':
        case 'workflow-finish':
          // End the span with accumulated content
          this.#endToolOutputSpan(toolCallId);
          break;

        // Ignore start/end markers - we handle accumulation ourselves
        case 'text-start':
        case 'text-end':
        case 'reasoning-start':
        case 'reasoning-end':
        case 'start':
        case 'workflow-start':
          break;

        default:
          // For other inner chunk types, we don't accumulate but we also don't
          // create extra spans - they'll be included in the final output
          break;
      }
    }
  }

  /**
   * End a tool output span and clean up the accumulator
   */
  #endToolOutputSpan(toolCallId: string) {
    const acc = this.#toolOutputAccumulators.get(toolCallId);
    if (!acc) return;

    // Build output with accumulated content
    const output: Record<string, any> = {
      toolCallId: acc.toolCallId,
      toolName: acc.toolName,
    };

    if (acc.text) {
      output.text = acc.text;
    }
    if (acc.reasoning) {
      output.reasoning = acc.reasoning;
    }

    acc.span?.end({ output });
    this.#toolOutputAccumulators.delete(toolCallId);

    // Mark this toolCallId as having had streaming output
    // so we can skip redundant tool-result spans
    this.#streamedToolCallIds.add(toolCallId);
  }

  /**
   * Wraps a stream with model tracing transform to track MODEL_STEP and MODEL_CHUNK spans.
   *
   * This should be added to the stream pipeline to automatically
   * create MODEL_STEP and MODEL_CHUNK spans for each semantic unit in the stream.
   */
  wrapStream<T extends { pipeThrough: Function }>(stream: T): T {
    return stream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
          // Capture completion start time on first actual content (for time-to-first-token)
          switch (chunk.type) {
            case 'text-delta':
            case 'tool-call-delta':
            case 'reasoning-delta':
              this.#captureCompletionStartTime();
              break;
          }

          controller.enqueue(chunk);

          // Handle chunk span tracking based on chunk type
          switch (chunk.type) {
            case 'text-start':
            case 'text-delta':
            case 'text-end':
              this.#handleTextChunk(chunk);
              break;

            case 'tool-call-input-streaming-start':
            case 'tool-call-delta':
            case 'tool-call-input-streaming-end':
            case 'tool-call':
              this.#handleToolCallChunk(chunk);
              break;

            case 'reasoning-start':
            case 'reasoning-delta':
            case 'reasoning-end':
              this.#handleReasoningChunk(chunk);
              break;

            case 'object':
            case 'object-result':
              this.#handleObjectChunk(chunk);
              break;

            case 'step-start':
              // If step already started (via startStep()), just update with payload data
              // Otherwise start a new step (for backwards compatibility)
              if (this.#currentStepSpan) {
                this.updateStep(chunk.payload);
              } else {
                this.startStep(chunk.payload);
              }
              break;

            case 'step-finish':
              this.#endStepSpan(chunk.payload);
              break;

            // Infrastructure chunks - skip creating spans for these
            // They are either redundant, metadata-only, or error/control flow
            case 'raw': // Redundant raw data
            case 'start': // Stream start marker
            case 'finish': // Stream finish marker (step-finish already captures this)
            case 'response-metadata': // Response metadata (not semantic content)
            case 'source': // Source references (metadata)
            case 'file': // Binary file data (too large/not semantic)
            case 'error': // Error handling
            case 'abort': // Abort signal
            case 'tripwire': // Processor rejection
            case 'watch': // Internal watch event
            case 'tool-error': // Tool error handling
            case 'tool-call-suspended': // Suspension (not content)
            case 'reasoning-signature': // Signature metadata
            case 'redacted-reasoning': // Redacted content metadata
            case 'step-output': // Step output wrapper (content is nested)
              // Don't create spans for these chunks
              break;

            case 'tool-call-approval': // Approval request - create span for debugging
              this.#handleToolApprovalChunk(chunk);
              break;

            case 'tool-output':
              // Consolidate streaming tool outputs (e.g., from sub-agents) into single spans
              this.#handleToolOutputChunk(chunk);
              break;

            case 'tool-result': {
              const toolCallId = chunk.payload?.toolCallId;

              // Skip tool-result if we already tracked streaming for this toolCallId
              // (the tool-output span captures duration and content better)
              if (toolCallId && this.#streamedToolCallIds.has(toolCallId)) {
                this.#streamedToolCallIds.delete(toolCallId); // Clean up
                break;
              }

              // For non-streaming tools, create the span but remove args from output
              // (args are redundant - already on the TOOL_CALL span input)
              const { args, ...cleanPayload } = chunk.payload || {};
              this.#createEventSpan(chunk.type, cleanPayload);
              break;
            }

            // Default: skip creating spans for unrecognized chunk types
            // All semantic content chunks should be explicitly handled above
            // Unknown chunks are likely infrastructure or custom chunks that don't need tracing
            default:
              // No span created - reduces trace noise
              break;
          }
        },
      }),
    ) as T;
  }
}
