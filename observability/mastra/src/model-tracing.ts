/**
 * Model Span Tracing
 *
 * Provides span tracking for Model generations, including:
 * - MODEL_STEP spans (one per Model API call)
 * - MODEL_CHUNK spans (individual streaming chunks within a step)
 *
 * Hierarchy: MODEL_GENERATION -> MODEL_STEP -> MODEL_CHUNK
 */

import { TransformStream } from 'stream/web';
import { SpanType } from '@mastra/core/observability';
import type {
  Span,
  EndSpanOptions,
  ErrorSpanOptions,
  TracingContext,
  UpdateSpanOptions,
} from '@mastra/core/observability';
import type { OutputSchema, ChunkType, StepStartPayload, StepFinishPayload } from '@mastra/core/stream';

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
  #accumulator: Record<string, any> = {};
  #stepIndex: number = 0;
  #chunkSequence: number = 0;

  constructor(modelSpan?: Span<SpanType.MODEL_GENERATION>) {
    this.#modelSpan = modelSpan;
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
   * End the generation span
   */
  endGeneration(options?: EndSpanOptions<SpanType.MODEL_GENERATION>): void {
    this.#modelSpan?.end(options);
  }

  /**
   * Update the generation span
   */
  updateGeneration(options: UpdateSpanOptions<SpanType.MODEL_GENERATION>): void {
    this.#modelSpan?.update(options);
  }

  /**
   * Start a new Model execution step
   */
  #startStepSpan(payload?: StepStartPayload) {
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
   * End the current Model execution step with token usage, finish reason, output, and metadata
   */
  #endStepSpan<OUTPUT extends OutputSchema>(payload: StepFinishPayload<any, OUTPUT>) {
    if (!this.#currentStepSpan) return;

    // Extract all data from step-finish chunk
    const output = payload.output;
    const { usage, ...otherOutput } = output;
    const stepResult = payload.stepResult;
    const metadata = payload.metadata;

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
      this.#startStepSpan();
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
      this.#startStepSpan();
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
  #handleTextChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>) {
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
  #handleReasoningChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>) {
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
  #handleToolCallChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>) {
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
  #handleObjectChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>) {
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
   * Wraps a stream with model tracing transform to track MODEL_STEP and MODEL_CHUNK spans.
   *
   * This should be added to the stream pipeline to automatically
   * create MODEL_STEP and MODEL_CHUNK spans for each semantic unit in the stream.
   */
  wrapStream<T extends { pipeThrough: Function }>(stream: T): T {
    return stream.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) => {
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
              this.#startStepSpan(chunk.payload);
              break;

            case 'step-finish':
              this.#endStepSpan(chunk.payload);
              break;

            case 'raw': // Skip raw chunks as they're redundant
            case 'start':
            case 'finish':
              // don't output these chunks that don't have helpful output
              break;

            // Default: auto-create event span for all other chunk types
            default: {
              let outputPayload = chunk.payload;

              // Special handling: if payload has 'data' field, replace with size
              if (outputPayload && typeof outputPayload === 'object' && 'data' in outputPayload) {
                const typedPayload = outputPayload as any;
                outputPayload = { ...typedPayload };
                if (typedPayload.data) {
                  (outputPayload as any).size =
                    typeof typedPayload.data === 'string'
                      ? typedPayload.data.length
                      : typedPayload.data instanceof Uint8Array
                        ? typedPayload.data.length
                        : undefined;
                  delete (outputPayload as any).data;
                }
              }

              this.#createEventSpan(chunk.type, outputPayload);
              break;
            }
          }
        },
      }),
    ) as T;
  }
}
