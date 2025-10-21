/**
 * Model Model Span Tracing
 *
 * Provides span tracking for Model generations, including:
 * - LLM_STEP spans (one per Model API call)
 * - LLM_CHUNK spans (individual streaming chunks within a step)
 *
 * Hierarchy: LLM_GENERATION -> LLM_STEP -> LLM_CHUNK
 */

import { TransformStream } from 'stream/web';
import type { ToolSet } from 'ai-v5';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType, StepStartPayload, StepFinishPayload } from '../stream/types';
import { AISpanType } from './types';
import type { AISpan } from './types';

/**
 * Manages LLM_STEP and LLM_CHUNK span tracking for streaming Model responses.
 *
 * Should be instantiated once per LLM_GENERATION span and shared across
 * all streaming steps (including after tool calls).
 */
export class ModelSpanTracker {
  private modelSpan?: AISpan<AISpanType.LLM_GENERATION>;
  private currentStepSpan?: AISpan<AISpanType.LLM_STEP>;
  private currentChunkSpan?: AISpan<AISpanType.LLM_CHUNK>;
  private accumulator: Record<string, any> = {};
  private stepIndex: number = 0;
  private chunkSequence: number = 0;

  constructor(modelSpan?: AISpan<AISpanType.LLM_GENERATION>) {
    this.modelSpan = modelSpan;
  }

  /**
   * Start a new Model execution step
   */
  startStepSpan(payload?: StepStartPayload) {
    this.currentStepSpan = this.modelSpan?.createChildSpan({
      name: `step: ${this.stepIndex}`,
      type: AISpanType.LLM_STEP,
      attributes: {
        stepIndex: this.stepIndex,
        ...(payload?.messageId ? { messageId: payload.messageId } : {}),
        ...(payload?.warnings?.length ? { warnings: payload.warnings } : {}),
      },
      input: payload?.request,
    });
    // Reset chunk sequence for new step
    this.chunkSequence = 0;
  }

  /**
   * End the current Model execution step with token usage, finish reason, output, and metadata
   */
  endStepSpan<OUTPUT extends OutputSchema>(payload: StepFinishPayload<ToolSet, OUTPUT>) {
    if (!this.currentStepSpan) return;

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

    this.currentStepSpan.end({
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
    this.currentStepSpan = undefined;
    this.stepIndex++;
  }

  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  startChunkSpan(chunkType: string, initialData?: Record<string, any>) {
    // Auto-create step if we see a chunk before step-start
    if (!this.currentStepSpan) {
      this.startStepSpan();
    }

    this.currentChunkSpan = this.currentStepSpan?.createChildSpan({
      name: `chunk: '${chunkType}'`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.chunkSequence,
      },
    });
    this.accumulator = initialData || {};
  }

  /**
   * Append string content to a specific field in the accumulator
   */
  appendToAccumulator(field: string, text: string) {
    if (this.accumulator[field] === undefined) {
      this.accumulator[field] = text;
    } else {
      this.accumulator[field] += text;
    }
  }

  /**
   * End the current chunk span.
   * Safe to call multiple times - will no-op if span already ended.
   */
  endChunkSpan(output?: any) {
    if (!this.currentChunkSpan) return;

    this.currentChunkSpan.end({
      output: output !== undefined ? output : this.accumulator,
    });
    this.currentChunkSpan = undefined;
    this.accumulator = {};
    this.chunkSequence++;
  }

  /**
   * Create an event span (for single chunks like tool-call)
   */
  createEventSpan(chunkType: string, output: any) {
    // Auto-create step if we see a chunk before step-start
    if (!this.currentStepSpan) {
      this.startStepSpan();
    }

    const span = this.currentStepSpan?.createEventSpan({
      name: `chunk: '${chunkType}'`,
      type: AISpanType.LLM_CHUNK,
      attributes: {
        chunkType,
        sequenceNumber: this.chunkSequence,
      },
      output,
    });

    if (span) {
      this.chunkSequence++;
    }
  }

  /**
   * Check if there is currently an active chunk span
   */
  hasActiveChunkSpan(): boolean {
    return !!this.currentChunkSpan;
  }

  /**
   * Get the current accumulator value
   */
  getAccumulator(): Record<string, any> {
    return this.accumulator;
  }

  /**
   * Get the current step span (for making tool calls children of steps)
   */
  getCurrentStepSpan(): AISpan<AISpanType.LLM_STEP> | undefined {
    return this.currentStepSpan;
  }

  /**
   * Wraps a stream with model tracing transform to track LLM_STEP and LLM_CHUNK spans.
   *
   * This should be added to the stream pipeline to automatically
   * create LLM_STEP and LLM_CHUNK spans for each semantic unit in the stream.
   */
  wrapStream<T extends { pipeThrough: Function }>(stream: T): T {
    const tracker = this;

    return stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);

          // Handle chunk span tracking based on chunk type
          switch (chunk.type) {
            case 'text-start':
            case 'text-delta':
            case 'text-end':
              handleTextChunk(chunk, tracker);
              break;

            case 'tool-call-input-streaming-start':
            case 'tool-call-delta':
            case 'tool-call-input-streaming-end':
            case 'tool-call':
              handleToolCallChunk(chunk, tracker);
              break;

            case 'reasoning-start':
            case 'reasoning-delta':
            case 'reasoning-end':
              handleReasoningChunk(chunk, tracker);
              break;

            case 'object':
            case 'object-result':
              handleObjectChunk(chunk, tracker);
              break;

            case 'step-start':
              tracker.startStepSpan(chunk.payload);
              break;

            case 'step-finish':
              tracker.endStepSpan(chunk.payload);
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

              tracker.createEventSpan(chunk.type, outputPayload);
              break;
            }
          }
        },
      }),
    ) as T;
  }
}

/**
 * Handler functions for multi-part chunk spans
 */

function handleTextChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>, tracker: ModelSpanTracker) {
  switch (chunk.type) {
    case 'text-start':
      tracker.startChunkSpan('text');
      break;

    case 'text-delta':
      tracker.appendToAccumulator('text', chunk.payload.text);
      break;

    case 'text-end': {
      tracker.endChunkSpan();
      break;
    }
  }
}

function handleReasoningChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>, tracker: ModelSpanTracker) {
  switch (chunk.type) {
    case 'reasoning-start':
      tracker.startChunkSpan('reasoning');
      break;

    case 'reasoning-delta':
      tracker.appendToAccumulator('text', chunk.payload.text);
      break;

    case 'reasoning-end': {
      tracker.endChunkSpan();
      break;
    }
  }
}

function handleToolCallChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>, tracker: ModelSpanTracker) {
  switch (chunk.type) {
    case 'tool-call-input-streaming-start':
      tracker.startChunkSpan('tool-call', {
        toolName: chunk.payload.toolName,
        toolCallId: chunk.payload.toolCallId,
      });
      break;

    case 'tool-call-delta':
      tracker.appendToAccumulator('toolInput', chunk.payload.argsTextDelta);
      break;

    case 'tool-call-input-streaming-end':
    case 'tool-call': {
      // Build output with toolName, toolCallId, and parsed toolInput
      const acc = tracker.getAccumulator();
      let toolInput;
      try {
        toolInput = acc.toolInput ? JSON.parse(acc.toolInput) : {};
      } catch {
        toolInput = acc.toolInput; // Keep as string if parsing fails
      }
      tracker.endChunkSpan({
        toolName: acc.toolName,
        toolCallId: acc.toolCallId,
        toolInput,
      });
      break;
    }
  }
}

function handleObjectChunk<OUTPUT extends OutputSchema>(chunk: ChunkType<OUTPUT>, tracker: ModelSpanTracker) {
  switch (chunk.type) {
    case 'object':
      // Start span on first partial object chunk (only if not already started)
      // Multiple object chunks may arrive as the object is being generated
      if (!tracker.hasActiveChunkSpan()) {
        tracker.startChunkSpan('object');
      }
      break;

    case 'object-result':
      // End the span with the final complete object as output
      tracker.endChunkSpan(chunk.object);
      break;
  }
}
