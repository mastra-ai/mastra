import type { TextStreamPart, ObjectStreamPart } from 'ai';

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
export class BatchPartsProcessor {
  public readonly name = 'batch-parts';
  private batch: (TextStreamPart<any> | ObjectStreamPart<any>)[] = [];
  private timeoutId?: NodeJS.Timeout;
  private timeoutTriggered = false;

  constructor(private options: BatchPartsOptions = {}) {
    this.options = {
      batchSize: 5,
      emitOnNonText: true,
      ...options,
    };
  }

  async processOutputStream(
    chunk: TextStreamPart<any> | ObjectStreamPart<any>,
  ): Promise<TextStreamPart<any> | ObjectStreamPart<any> | null> {
    // Check if a timeout has triggered a flush
    if (this.timeoutTriggered && this.batch.length > 0) {
      this.timeoutTriggered = false;
      const batchedChunk = this.flushBatch();
      // Add the current chunk to the batch for next time
      this.batch.push(chunk);
      return batchedChunk;
    }

    // If it's a non-text part and we should emit immediately, flush the batch first
    if (this.options.emitOnNonText && chunk.type !== 'text-delta') {
      const batchedChunk = this.flushBatch();
      // Return the batched chunk if there was one, otherwise return the current chunk
      // Don't add the current non-text chunk to the batch - emit it immediately
      return batchedChunk || chunk;
    }

    // Add the chunk to the current batch
    this.batch.push(chunk);

    // Check if we should emit based on batch size
    if (this.batch.length >= this.options.batchSize!) {
      return this.flushBatch();
    }

    // Set up timeout for max wait time if specified
    if (this.options.maxWaitTime && !this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        // Mark that a timeout has triggered
        this.timeoutTriggered = true;
        this.timeoutId = undefined;
      }, this.options.maxWaitTime);
    }

    // Don't emit this chunk yet - it's batched
    return null;
  }

  private flushBatch(): TextStreamPart<any> | ObjectStreamPart<any> | null {
    if (this.batch.length === 0) {
      return null;
    }

    // Clear any existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    // If we only have one chunk, return it directly
    if (this.batch.length === 1) {
      const chunk = this.batch[0];
      this.batch = [];
      return chunk || null;
    }

    // Combine multiple text chunks into a single text chunk
    const textChunks = this.batch.filter(chunk => chunk.type === 'text-delta') as TextStreamPart<any>[];
    const nonTextChunks = this.batch.filter(chunk => chunk.type !== 'text-delta');

    if (textChunks.length > 0) {
      // Combine all text deltas
      const combinedText = textChunks.map(chunk => (chunk as any).textDelta).join('');

      // Create a new combined text chunk
      const combinedChunk: TextStreamPart<any> = {
        type: 'text-delta',
        textDelta: combinedText,
      } as any;

      // Reset batch and add any non-text chunks back
      this.batch = nonTextChunks;

      return combinedChunk;
    } else {
      // If no text chunks, return the first non-text chunk
      const chunk = this.batch[0];
      this.batch = this.batch.slice(1);
      return chunk || null;
    }
  }

  /**
   * Force flush any remaining batched parts
   * This should be called when the stream ends to ensure no parts are lost
   */
  flush(): TextStreamPart<any> | ObjectStreamPart<any> | null {
    return this.flushBatch();
  }
}
