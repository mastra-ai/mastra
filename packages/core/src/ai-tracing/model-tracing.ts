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
import type { ToolSet } from 'ai-v5';
import type { MastraError } from '../error';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType, StepStartPayload, StepFinishPayload } from '../stream/types';
import { AISpanType } from './types';
import type { AISpan, AnyAISpan, ModelGenerationAttributes } from './types';

/**
 * Manages MODEL_STEP and MODEL_CHUNK span tracking for streaming Model responses.
 *
 * Should be instantiated once per MODEL_GENERATION span and shared across
 * all streaming steps (including after tool calls).
 */
export class ModelSpanTracker {
  #modelSpan?: AISpan<AISpanType.MODEL_GENERATION>;
  #currentStepSpan?: AISpan<AISpanType.MODEL_STEP>;
  #currentChunkSpan?: AISpan<AISpanType.MODEL_CHUNK>;
  #accumulator: Record<string, any> = {};
  #stepIndex: number = 0;
  #chunkSequence: number = 0;

  constructor(modelSpan?: AISpan<AISpanType.MODEL_GENERATION>) {
    this.#modelSpan = modelSpan;
  }

  /**
   * Get the tracing context for creating child spans.
   * Returns the current step span if active, otherwise the model span.
   */
  getTracingContext(): { currentSpan?: AnyAISpan } {
    return {
      currentSpan: this.#currentStepSpan ?? this.#modelSpan,
    };
  }

  /**
   * Report an error on the generation span
   */
  reportGenerationError(options: { error: MastraError | Error; endSpan?: boolean }): void {
    this.#modelSpan?.error(options);
  }

  /**
   * End the generation span
   */
  endGeneration(options?: {
    output?: any;
    attributes?: Partial<ModelGenerationAttributes>;
    metadata?: Record<string, any>;
  }): void {
    this.#modelSpan?.end(options);
  }

  /**
   * Update the generation span
   */
  updateGeneration(options: {
    input?: any;
    output?: any;
    attributes?: Partial<ModelGenerationAttributes>;
    metadata?: Record<string, any>;
  }): void {
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
      type: AISpanType.MODEL_STEP,
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
  #endStepSpan<OUTPUT extends OutputSchema>(payload: StepFinishPayload<ToolSet, OUTPUT>) {
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
      this.startStep();
    }

    this.#currentChunkSpan = this.#currentStepSpan?.createChildSpan({
      name: `chunk: '${chunkType}'`,
      type: AISpanType.MODEL_CHUNK,
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
      type: AISpanType.MODEL_CHUNK,
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
