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
export class ModelSpanTracker {
  #modelSpan?: Span<SpanType.MODEL_GENERATION>;
  #currentStepSpan?: Span<SpanType.MODEL_STEP>;
  #currentChunkSpan?: Span<SpanType.MODEL_CHUNK>;
  #currentChunkType?: string;
  #accumulator: Record<string, any> = {};
  #stepIndex: number = 0;
  #chunkSequence: number = 0;
  #completionStartTime?: Date;
  /** When true, step-finish chunks don't auto-close the step span (for durable execution) */
  #deferStepClose: boolean = false;
  /** Stored step-finish payload when defer mode is enabled */
  #pendingStepFinishPayload?: StepFinishPayload<any, any>;

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
   * Enable or disable deferred step closing for durable execution.
   * When enabled, step-finish chunks won't automatically close the step span.
   * Use exportCurrentStep() to get the span data, then close it manually later.
   */
  setDeferStepClose(defer: boolean): void {
    this.#deferStepClose = defer;
  }

  /**
   * Export the current step span for later rebuilding (durable execution).
   * Returns undefined if no step span is active.
   */
  exportCurrentStep(): ReturnType<Span<SpanType.MODEL_STEP>['exportSpan']> | undefined {
    return this.#currentStepSpan?.exportSpan();
  }

  /**
   * Get the pending step finish payload (captured when defer mode is enabled).
   * This contains usage, finishReason, etc. for closing the step later.
   */
  getPendingStepFinishPayload(): StepFinishPayload<any, any> | undefined {
    return this.#pendingStepFinishPayload;
  }

  /**
   * Set the starting step index for durable execution.
   * Used when resuming across agentic loop iterations to maintain step continuity.
   */
  setStepIndex(index: number): void {
    this.#stepIndex = index;
  }

  /**
   * Get the current step index.
   */
  getStepIndex(): number {
    return this.#stepIndex;
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
    // Flush any pending chunk span before ending the step
    // (handles case where text-delta arrives without text-end)
    this.#endChunkSpan();

    if (!this.#currentStepSpan) return;

    // Extract all data from step-finish chunk
    const output = payload.output;
    const { usage: rawUsage, ...otherOutput } = output;
    const stepResult = payload.stepResult;
    const metadata = payload.metadata;

    // Convert raw usage to UsageStats with cache token details
    const usage = extractUsageMetrics(rawUsage, metadata?.providerMetadata);

    // Remove verbose/redundant fields from metadata:
    // - request: too verbose
    // - id/timestamp: chunk-level data, not step-related
    // - modelId/modelVersion/modelProvider: duplicates of modelMetadata
    const cleanMetadata = metadata ? { ...metadata } : undefined;
    if (cleanMetadata) {
      for (const key of ['request', 'id', 'timestamp', 'modelId', 'modelVersion', 'modelProvider']) {
        delete cleanMetadata[key];
      }
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
    // End any existing chunk span before starting a new one
    // (handles transitions like text-delta → tool-call without text-end)
    this.#endChunkSpan();

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
    this.#currentChunkType = chunkType;
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
    this.#currentChunkType = undefined;
    this.#accumulator = {};
    this.#chunkSequence++;
  }

  /**
   * Create an event span (for single chunks like tool-call)
   */
  #createEventSpan(
    chunkType: string,
    output: any,
    options?: { attributes?: Record<string, any>; metadata?: Record<string, any> },
  ) {
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
        ...options?.attributes,
      },
      metadata: options?.metadata,
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
        // Auto-create span if we receive text-delta without text-start
        // (AI SDK streaming doesn't always emit wrapper events)
        // Allow transition from any other chunk type
        if (this.#currentChunkType !== 'text') {
          this.#startChunkSpan('text');
        }
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
        // Auto-create span if we receive reasoning-delta without reasoning-start
        // (AI SDK streaming doesn't always emit wrapper events)
        // Allow transition from any other chunk type
        if (this.#currentChunkType !== 'reasoning') {
          this.#startChunkSpan('reasoning');
        }
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
        // Check specifically for object chunk type to allow transitioning from other types
        if (this.#currentChunkType !== 'object') {
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
    const payload = chunk.payload;

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
      },
      output: payload,
    });

    if (span) {
      this.#chunkSequence++;
    }
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
              if (this.#deferStepClose) {
                // Durable mode: save payload for later, don't close the step
                this.#pendingStepFinishPayload = chunk.payload;
              } else {
                // Normal mode: close the step immediately
                this.#endStepSpan(chunk.payload);
              }
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
              // tool-output chunks are streaming progress from tools (e.g., sub-agents)
              // No span created - the final tool-result event captures the result
              break;

            case 'tool-result': {
              // tool-result is always a point-in-time event span
              // (tool execution duration is captured by the parent tool_call span)
              const {
                // Metadata - tool call context (unique to tool-result chunks)
                toolCallId,
                toolName,
                isError,
                dynamic,
                providerExecuted,
                providerMetadata,
                // Output - the actual result
                result,
                // Stripped - redundant (already on TOOL_CALL span input)
                args: _args,
              } = (chunk.payload as Record<string, any>) || {};

              // All tool-result specific fields go in metadata
              const metadata: Record<string, any> = { toolCallId, toolName };
              if (isError !== undefined) metadata.isError = isError;
              if (dynamic !== undefined) metadata.dynamic = dynamic;
              if (providerExecuted !== undefined) metadata.providerExecuted = providerExecuted;
              if (providerMetadata !== undefined) metadata.providerMetadata = providerMetadata;

              this.#createEventSpan(chunk.type, result, { metadata });
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
