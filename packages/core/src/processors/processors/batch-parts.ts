import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import type { Processor } from '../index';

export type BatchPartsState = {
  batch: ChunkType[];
  timeoutId: NodeJS.Timeout | undefined;
  timeoutTriggered: boolean;
};

export interface BatchPartsOptions {
  /**
   * Number of parts to batch together before emitting
   * @default 5
   */
  batchSize?: number;

  /**
   * Maximum time to wait before emitting a batch (in milliseconds)
   * If set, will emit the current batch even if it hasn't reached batchSize
   * @default undefined (no timeout)
   */
  maxWaitTime?: number;

  /**
   * Whether to emit immediately when a non-text part is encountered
   * @default true
   */
  emitOnNonText?: boolean;
}

/**
 * Processor that batches multiple stream parts together to reduce stream overhead.
 * Only implements processOutputStream - does not process final results.
 */
export class BatchPartsProcessor implements Processor {
  public readonly name = 'batch-parts';

  constructor(private options: BatchPartsOptions = {}) {
    this.options = {
      batchSize: 5,
      emitOnNonText: true,
      ...options,
    };
  }

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
  }): Promise<ChunkType | null> {
    const { part, state } = args;

    // Initialize state if not present
    if (!state.batch) {
      state.batch = [];
    }
    if (!state.timeoutTriggered) {
      state.timeoutTriggered = false;
    }

    // Check if a timeout has triggered a flush
    if (state.timeoutTriggered && state.batch.length > 0) {
      state.timeoutTriggered = false;
      // Add the current part to the batch before flushing
      state.batch.push(part);
      const batchedChunk = this.flushBatch(state as BatchPartsState);
      return batchedChunk;
    }

    // If it's a non-text part and we should emit immediately, flush the batch first
    if (this.options.emitOnNonText && part.type !== 'text-delta') {
      const batchedChunk = this.flushBatch(state as BatchPartsState);
      // Return the batched part if there was one, otherwise return the current part
      // Don't add the current non-text part to the batch - emit it immediately
      if (batchedChunk) {
        return batchedChunk;
      }
      return part;
    }

    // Add the part to the current batch
    state.batch.push(part);

    // Check if we should emit based on batch size
    if (state.batch.length >= this.options.batchSize!) {
      return this.flushBatch(state as BatchPartsState);
    }

    // Set up timeout for max wait time if specified
    if (this.options.maxWaitTime && !state.timeoutId) {
      state.timeoutId = setTimeout(() => {
        // Mark that a timeout has triggered
        state.timeoutTriggered = true;
        state.timeoutId = undefined;
      }, this.options.maxWaitTime);
    }

    // Don't emit this part yet - it's batched
    return null;
  }

  private flushBatch(state: BatchPartsState): ChunkType | null {
    if (state.batch.length === 0) {
      return null;
    }

    // Clear any existing timeout
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = undefined;
    }

    // If we only have one part, return it directly
    if (state.batch.length === 1) {
      const part = state.batch[0];
      state.batch = [];
      return part || null;
    }

    // Combine multiple text chunks into a single text part
    const textChunks = state.batch.filter((part: ChunkType) => part.type === 'text-delta') as ChunkType[];

    if (textChunks.length > 0) {
      // Combine all text deltas
      const combinedText = textChunks.map(part => (part.type === 'text-delta' ? part.payload.text : '')).join('');

      // Create a new combined text part
      const combinedChunk: ChunkType = {
        type: 'text-delta',
        payload: { text: combinedText, id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      // Clear the batch completely - non-text chunks should be handled by the main logic
      // when they arrive, not accumulated here
      state.batch = [];

      return combinedChunk;
    } else {
      // If no text chunks, return the first non-text part
      const part = state.batch[0];
      state.batch = state.batch.slice(1);
      return part || null;
    }
  }

  /**
   * Force flush any remaining batched parts
   * This should be called when the stream ends to ensure no parts are lost
   */
  flush(state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false }): ChunkType | null {
    // Initialize state if not present
    if (!state.batch) {
      state.batch = [];
    }
    return this.flushBatch(state);
  }
}
