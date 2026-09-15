import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import type { Processor } from '../index';
import { REPROCESS_PART_KEY } from '../stream-reprocess';

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
export class BatchPartsProcessor implements Processor<'batch-parts'> {
  public readonly id = 'batch-parts';
  public readonly name = 'Batch Parts';

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
    writer?: { custom: (data: ChunkType) => Promise<void> };
  }): Promise<ChunkType | null> {
    const { part, state, writer } = args;

    // Initialize state if not present
    if (!state.batch) {
      state.batch = [];
    }
    if (!state.timeoutTriggered) {
      state.timeoutTriggered = false;
    }

    // Emit any pending non-text part that was deferred from the previous call
    if (state.pendingNonText) {
      const pending = state.pendingNonText;
      state.pendingNonText = undefined;
      // Buffer the current part for later emission
      state.batch.push(part);
      return pending;
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
      if (batchedChunk) {
        // We have two parts to emit (the batched text and this non-text part)
        // but can only return one. When running inside the processor chain,
        // return the batched text (so it flows through any downstream
        // processors) and stash the non-text part for the runner to re-drive
        // through the whole chain right after. This avoids deferring the
        // non-text part to the next processOutputStream call — which never
        // happens when the stream stops on this part (e.g. a `stopWhen`
        // condition halting the agentic loop on a tool result), dropping the
        // part from the stream entirely.
        if (writer) {
          state[REPROCESS_PART_KEY] = part;
          return batchedChunk;
        }
        // No writer (e.g. direct unit invocation): fall back to deferring the
        // non-text part to the next call.
        state.pendingNonText = part;
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

    // Emit the batch one part at a time, preserving order. Non-text parts can be
    // buffered alongside text (e.g. when `emitOnNonText` is false), so we must not
    // drop them when combining text. If the batch leads with a non-text part,
    // emit it directly.
    if (state.batch[0] && state.batch[0].type !== 'text-delta') {
      const part = state.batch[0];
      state.batch = state.batch.slice(1);
      return part || null;
    }

    // Otherwise combine the leading run of contiguous text deltas into a single
    // text part, keeping any later parts in the batch for subsequent flushes.
    let textRunEnd = 0;
    while (textRunEnd < state.batch.length && state.batch[textRunEnd]?.type === 'text-delta') {
      textRunEnd++;
    }
    const textChunks = state.batch.slice(0, textRunEnd) as (ChunkType & { type: 'text-delta' })[];
    const combinedText = textChunks.map(part => part.payload.text).join('');

    // Preserve id and runId from the first chunk
    const firstChunk = textChunks[0]!;
    const combinedChunk: ChunkType = {
      type: 'text-delta',
      payload: { text: combinedText, id: firstChunk.payload.id },
      runId: firstChunk.runId,
      from: ChunkFrom.AGENT,
    };

    state.batch = state.batch.slice(textRunEnd);

    return combinedChunk;
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
