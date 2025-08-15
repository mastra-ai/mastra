import type { TextStreamPart, ObjectStreamPart } from 'ai';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchPartsProcessor } from './batch-parts';



describe('BatchPartsProcessor', () => {
  let processor: BatchPartsProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic batching', () => {
    it('should batch text chunks and emit when batch size is reached', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      // First two chunks should not be emitted
      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' ' };
      const chunk3: TextStreamPart<any> = { type: 'text-delta', textDelta: 'world' };

      // Use shared state object
      const state: Record<string, any> = {};

      const result1 = await processor.processOutputStream({
        chunk: chunk1,
        allChunks: [chunk1],
        state,
        abort: () => { throw new Error('abort'); },
      });
      const result2 = await processor.processOutputStream({
        chunk: chunk2,
        allChunks: [chunk1, chunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });
      const result3 = await processor.processOutputStream({
        chunk: chunk3,
        allChunks: [chunk1, chunk2, chunk3],
        state,
        abort: () => { throw new Error('abort'); },
      });

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toEqual({
        type: 'text-delta',
        textDelta: 'Hello world',
      });
    });

    it('should use default batch size of 5', async () => {
      processor = new BatchPartsProcessor();

      const chunks = [
        { type: 'text-delta', textDelta: 'A' },
        { type: 'text-delta', textDelta: 'B' },
        { type: 'text-delta', textDelta: 'C' },
        { type: 'text-delta', textDelta: 'D' },
        { type: 'text-delta', textDelta: 'E' },
      ] as TextStreamPart<any>[];

      // Use shared state object
      const state: Record<string, any> = {};

      // First 4 should return null
      for (let i = 0; i < 4; i++) {
        const result = await processor.processOutputStream({
          chunk: chunks[i],
          allChunks: chunks.slice(0, i),
          state,
          abort: () => { throw new Error('abort'); },
        });
        expect(result).toBeNull();
      }

      // 5th should emit the combined batch
      const result = await processor.processOutputStream({
        chunk: chunks[4],
        allChunks: chunks.slice(0, 4),
        state,
        abort: () => { throw new Error('abort'); },
      });
      expect(result).toEqual({
        type: 'text-delta',
        textDelta: 'ABCDE',
      });
    });
  });

  describe('non-text chunks', () => {
    it('should emit immediately when non-text chunk is encountered (default behavior)', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      // Add some text chunks first
      const textChunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const textChunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world' };

      // Use shared state object
      const state: Record<string, any> = {};

      await processor.processOutputStream({
        chunk: textChunk1,
        allChunks: [textChunk1],
        state,
        abort: () => { throw new Error('abort'); },
      });
      await processor.processOutputStream({
        chunk: textChunk2,
        allChunks: [textChunk1, textChunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Now add a non-text chunk
      const objectChunk: ObjectStreamPart<any> = { type: 'object', object: { key: 'value' } };
      const result = await processor.processOutputStream({
        chunk: objectChunk,
        allChunks: [textChunk1, textChunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Should emit the batched text first
      expect(result).toEqual({
        type: 'text-delta',
        textDelta: 'Hello world',
      });
    });

    it('should not emit immediately when emitOnNonText is false', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5, emitOnNonText: false });

      // Add some text chunks first
      const textChunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      await processor.processOutputStream({
        chunk: textChunk,
        allChunks: [textChunk],
        state: {},
        abort: () => { throw new Error('abort'); },
      });

      // Add a non-text chunk
      const objectChunk: ObjectStreamPart<any> = { type: 'object', object: { key: 'value' } };
        const result = await processor.processOutputStream({
        chunk: objectChunk,
        allChunks: [objectChunk],
        state: {},
        abort: () => { throw new Error('abort'); },
      });

      // Should not emit yet
      expect(result).toBeNull();
    });

    it('should handle mixed text and non-text chunks correctly', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const chunks: (TextStreamPart<any> | ObjectStreamPart<any>)[] = [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'object', object: { key: 'value' } },
        { type: 'text-delta', textDelta: ' world' },
        { type: 'text-delta', textDelta: '!' },
      ];

      // Use shared state object
      const state: Record<string, any> = {};

      // First chunk - should not emit
      let result = await processor.processOutputStream({
        chunk: chunks[0],
        allChunks: [chunks[0]],
        state,
        abort: () => { throw new Error('abort'); },
      });
      expect(result).toBeNull();

      // Second chunk (object) - should emit the text chunk immediately
      result = await processor.processOutputStream({
        chunk: chunks[1],
        allChunks: [chunks[1]],
        state,
        abort: () => { throw new Error('abort'); },
      });
      expect(result).toEqual({
        type: 'text-delta',
        textDelta: 'Hello',
      });

      // Third and fourth chunks - should batch together
      result = await processor.processOutputStream({
        chunk: chunks[2],
        allChunks: [chunks[2]],
        state,
        abort: () => { throw new Error('abort'); },
      });
      expect(result).toBeNull();

      result = await processor.processOutputStream({
        chunk: chunks[3],
        allChunks: [chunks[3]],
        state,
        abort: () => { throw new Error('abort'); },
      });
      expect(result).toBeNull(); // Should not emit yet since batch size is 3 and we only have 2 chunks
    });
  });

  describe('timeout functionality', () => {
    it('should emit batch after maxWaitTime even if batch size not reached', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5, maxWaitTime: 1000 });

      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world' };

      // Use shared state object
      const state: Record<string, any> = {};

      // Add chunks
      await processor.processOutputStream({
        chunk: chunk1,
        allChunks: [chunk1],
        state,
        abort: () => { throw new Error('abort'); },
      });
      await processor.processOutputStream({
        chunk: chunk2,
        allChunks: [chunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Advance time past the timeout
      vi.advanceTimersByTime(1100);

      // The timeout should have triggered and emitted the batch
      // We need to process another chunk to see the result
      const chunk3: TextStreamPart<any> = { type: 'text-delta', textDelta: '!' };
        const result = await processor.processOutputStream({
        chunk: chunk3,
        allChunks: [chunk3],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Should emit the batched text including the current chunk when timeout triggers
      expect(result).toEqual({
        type: 'text-delta',
        textDelta: 'Hello world!',
      });
    });

    it('should not set timeout if maxWaitTime is not specified', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      await processor.processOutputStream({
        chunk: chunk,
        allChunks: [chunk],
        state: {},
        abort: () => { throw new Error('abort'); },
      });

      // Advance time - should not trigger any emission
      vi.advanceTimersByTime(5000);

      // Should still not emit until batch size is reached
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world' };
      const result = await processor.processOutputStream({
        chunk: chunk2,
        allChunks: [chunk2],
        state: {},
        abort: () => { throw new Error('abort'); },
      });
      expect(result).toBeNull();
    });
  });

  describe('flush functionality', () => {
    it('should flush remaining chunks when flush is called', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      const chunks = [
        { type: 'text-delta', textDelta: 'Hello' },
        { type: 'text-delta', textDelta: ' world' },
      ] as TextStreamPart<any>[];

      // Use shared state object
      const state: Record<string, any> = {};

      // Add chunks (should not emit yet)
      await processor.processOutputStream({
        chunk: chunks[0],
        allChunks: [chunks[0]],
        state,
        abort: () => { throw new Error('abort'); },
      });
      await processor.processOutputStream({
        chunk: chunks[1],
        allChunks: [chunks[1]],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Flush should emit the remaining chunks
      const result = processor.flush(state);
      expect(result).toEqual({
        type: 'text-delta',
        textDelta: 'Hello world',
      });
    });

    it('should return null when flush is called on empty batch', () => {
      processor = new BatchPartsProcessor();
      const result = processor.flush();
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle single chunk correctly', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const chunk: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const result = await processor.processOutputStream({
        chunk: chunk,
        allChunks: [chunk],
        state: {},
        abort: () => { throw new Error('abort'); },
      });

      // Should not emit until batch size is reached
      expect(result).toBeNull();
    });

    it('should handle empty text deltas', async () => {
      processor = new BatchPartsProcessor({ batchSize: 2 });

      const chunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: '' };
      const chunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };

      // Use shared state object
      const state: Record<string, any> = {};

      const result1 = await processor.processOutputStream({
        chunk: chunk1,
        allChunks: [chunk1],
        state,
        abort: () => { throw new Error('abort'); },
      });
      const result2 = await processor.processOutputStream({
        chunk: chunk2,
        allChunks: [chunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });

      expect(result1).toBeNull();
      expect(result2).toEqual({
        type: 'text-delta',
        textDelta: 'Hello',
      });
    });

    it('should handle only non-text chunks', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const objectChunk1: ObjectStreamPart<any> = { type: 'object', object: { key1: 'value1' } };
      const objectChunk2: ObjectStreamPart<any> = { type: 'object', object: { key2: 'value2' } };

      // Use shared state object
      const state: Record<string, any> = {};

      const result1 = await processor.processOutputStream({
        chunk: objectChunk1,
        allChunks: [objectChunk1],
        state,
        abort: () => { throw new Error('abort'); },
      });
      const result2 = await processor.processOutputStream({
        chunk: objectChunk2,
        allChunks: [objectChunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Should emit both object chunks immediately since emitOnNonText is true
      expect(result1).toEqual(objectChunk1);
      expect(result2).toEqual(objectChunk2);
    });

    it('should not accumulate non-text chunks in batch after text processing', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      // Use shared state object
      const state: Record<string, any> = {};

      // Add text chunks first
      const textChunk1: TextStreamPart<any> = { type: 'text-delta', textDelta: 'Hello' };
      const textChunk2: TextStreamPart<any> = { type: 'text-delta', textDelta: ' world' };
      const textChunk3: TextStreamPart<any> = { type: 'text-delta', textDelta: '!' };

      // First two should not emit
      await processor.processOutputStream({
        chunk: textChunk1,
        allChunks: [textChunk1],
        state,
        abort: () => { throw new Error('abort'); },
      });
      await processor.processOutputStream({
        chunk: textChunk2,
        allChunks: [textChunk1, textChunk2],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Third should emit the combined text
      const result = await processor.processOutputStream({
        chunk: textChunk3,
        allChunks: [textChunk1, textChunk2, textChunk3],
        state,
        abort: () => { throw new Error('abort'); },
      });

      expect(result).toEqual({
        type: 'text-delta',
        textDelta: 'Hello world!',
      });

      // Now add a non-text chunk - it should be emitted immediately and not accumulated
      const objectChunk: ObjectStreamPart<any> = { type: 'object', object: { key: 'value' } };
      const result2 = await processor.processOutputStream({
        chunk: objectChunk,
        allChunks: [objectChunk],
        state,
        abort: () => { throw new Error('abort'); },
      });

      // Should emit the object chunk immediately, not accumulate it
      expect(result2).toEqual(objectChunk);
    });
  });
});
