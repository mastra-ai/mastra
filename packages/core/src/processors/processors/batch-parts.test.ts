import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import { BatchPartsProcessor } from './batch-parts';
import type { BatchPartsState } from './batch-parts';

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

      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' ', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk3: ChunkType = {
        type: 'text-delta',
        payload: { text: 'world', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const result1 = await processor.processOutputStream({
        part: chunk1,
        streamParts: [chunk1],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      const result2 = await processor.processOutputStream({
        part: chunk2,
        streamParts: [chunk1, chunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      const result3 = await processor.processOutputStream({
        part: chunk3,
        streamParts: [chunk1, chunk2, chunk3],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world', id: '1' },
      });
    });

    it('should use default batch size of 5', async () => {
      processor = new BatchPartsProcessor();

      const chunks = [
        { type: 'text-delta', payload: { text: 'A', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'B', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'C', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'D', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'E', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
      ] as ChunkType[];

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      // First 4 should return null
      for (let i = 0; i < 4; i++) {
        const result = await processor.processOutputStream({
          part: chunks[i],
          streamParts: chunks.slice(0, i),
          state,
          abort: () => {
            throw new Error('abort');
          },
        });
        expect(result).toBeNull();
      }

      // 5th should emit the combined batch
      const result = await processor.processOutputStream({
        part: chunks[4],
        streamParts: chunks.slice(0, 4),
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'ABCDE', id: '1' },
      });
    });
  });

  describe('non-text chunks', () => {
    it('should emit immediately when non-text part is encountered (default behavior)', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      // Add some text chunks first
      const textChunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const textChunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      await processor.processOutputStream({
        part: textChunk1,
        streamParts: [textChunk1],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      await processor.processOutputStream({
        part: textChunk2,
        streamParts: [textChunk1, textChunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Now add a non-text part
      const objectChunk: ChunkType = { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT };
      const result = await processor.processOutputStream({
        part: objectChunk,
        streamParts: [textChunk1, textChunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Should emit the batched text first
      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world', id: '1' },
      });
    });

    it('should not emit immediately when emitOnNonText is false', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5, emitOnNonText: false });

      // Add some text chunks first
      const textChunk: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      await processor.processOutputStream({
        part: textChunk,
        streamParts: [textChunk],
        state: {},
        abort: () => {
          throw new Error('abort');
        },
      });

      // Add a non-text part
      const objectChunk: ChunkType = { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT };
      const result = await processor.processOutputStream({
        part: objectChunk,
        streamParts: [objectChunk],
        state: {},
        abort: () => {
          throw new Error('abort');
        },
      });

      // Should not emit yet
      expect(result).toBeNull();
    });

    it('should handle mixed text and non-text chunks correctly', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const chunks: ChunkType[] = [
        { type: 'text-delta', payload: { text: 'Hello', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' world', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: '!', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
      ];

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      // First part - should not emit
      let result = await processor.processOutputStream({
        part: chunks[0],
        streamParts: [chunks[0]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toBeNull();

      // Second part (object) - should emit the text part immediately
      result = await processor.processOutputStream({
        part: chunks[1],
        streamParts: [chunks[1]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello', id: '1' },
      });

      // Third and fourth chunks - should batch together
      result = await processor.processOutputStream({
        part: chunks[2],
        streamParts: [chunks[2]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toBeNull();

      result = await processor.processOutputStream({
        part: chunks[3],
        streamParts: [chunks[3]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toBeNull(); // Should not emit yet since batch size is 3 and we only have 2 chunks
    });
  });

  describe('timeout functionality', () => {
    it('should emit batch after maxWaitTime even if batch size not reached', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5, maxWaitTime: 1000 });

      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      // Add chunks
      await processor.processOutputStream({
        part: chunk1,
        streamParts: [chunk1],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      await processor.processOutputStream({
        part: chunk2,
        streamParts: [chunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Advance time past the timeout
      vi.advanceTimersByTime(1100);

      // The timeout should have triggered and emitted the batch
      // We need to process another part to see the result
      const chunk3: ChunkType = {
        type: 'text-delta',
        payload: { text: '!', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({
        part: chunk3,
        streamParts: [chunk3],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Should emit the batched text including the current part when timeout triggers
      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world!', id: '1' },
      });
    });

    it('should not set timeout if maxWaitTime is not specified', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      await processor.processOutputStream({
        part: part,
        streamParts: [part],
        state: {},
        abort: () => {
          throw new Error('abort');
        },
      });

      // Advance time - should not trigger any emission
      vi.advanceTimersByTime(5000);

      // Should still not emit until batch size is reached
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({
        part: chunk2,
        streamParts: [chunk2],
        state: {},
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toBeNull();
    });
  });

  describe('flush functionality', () => {
    it('should flush remaining chunks when flush is called', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      const chunks = [
        { type: 'text-delta', payload: { text: 'Hello', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' world', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
      ] as ChunkType[];

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      // Add chunks (should not emit yet)
      await processor.processOutputStream({
        part: chunks[0],
        streamParts: [chunks[0]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      await processor.processOutputStream({
        part: chunks[1],
        streamParts: [chunks[1]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Flush should emit the remaining chunks
      const result = processor.flush(state);
      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world', id: '1' },
      });
    });

    it('should return null when flush is called on empty batch', () => {
      processor = new BatchPartsProcessor();
      const result = processor.flush();
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle single part correctly', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const result = await processor.processOutputStream({
        part: part,
        streamParts: [part],
        state: {},
        abort: () => {
          throw new Error('abort');
        },
      });

      // Should not emit until batch size is reached
      expect(result).toBeNull();
    });

    it('should handle empty text deltas', async () => {
      processor = new BatchPartsProcessor({ batchSize: 2 });

      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: '', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const result1 = await processor.processOutputStream({
        part: chunk1,
        streamParts: [chunk1],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      const result2 = await processor.processOutputStream({
        part: chunk2,
        streamParts: [chunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      expect(result1).toBeNull();
      expect(result2).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello', id: '1' },
      });
    });

    it('should handle only non-text chunks', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const objectChunk1: ChunkType = { type: 'object', object: { key1: 'value1' }, runId: '1', from: ChunkFrom.AGENT };
      const objectChunk2: ChunkType = { type: 'object', object: { key2: 'value2' }, runId: '1', from: ChunkFrom.AGENT };

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const result1 = await processor.processOutputStream({
        part: objectChunk1,
        streamParts: [objectChunk1],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      const result2 = await processor.processOutputStream({
        part: objectChunk2,
        streamParts: [objectChunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Should emit both object chunks immediately since emitOnNonText is true
      expect(result1).toEqual(objectChunk1);
      expect(result2).toEqual(objectChunk2);
    });

    it('should not accumulate non-text chunks in batch after text processing', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      // Use shared state object
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      // Add text chunks first
      const textChunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const textChunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const textChunk3: ChunkType = {
        type: 'text-delta',
        payload: { text: '!', id: '1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };

      // First two should not emit
      await processor.processOutputStream({
        part: textChunk1,
        streamParts: [textChunk1],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      await processor.processOutputStream({
        part: textChunk2,
        streamParts: [textChunk1, textChunk2],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Third should emit the combined text
      const result = await processor.processOutputStream({
        part: textChunk3,
        streamParts: [textChunk1, textChunk2, textChunk3],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world!', id: '1' },
      });

      // Now add a non-text part - it should be emitted immediately and not accumulated
      const objectChunk: ChunkType = { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT };
      const result2 = await processor.processOutputStream({
        part: objectChunk,
        streamParts: [objectChunk],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      // Should emit the object part immediately, not accumulate it
      expect(result2).toEqual(objectChunk);
    });
  });
});
