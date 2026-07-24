import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChunkType } from '../../stream';
import { ChunkFrom } from '../../stream/types';
import { BATCH_PARTS_GUARDRAIL_CONTEXT_KEY, BatchPartsProcessor } from './batch-parts';
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
        payload: { text: 'Hello', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' ', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk3: ChunkType = {
        type: 'text-delta',
        payload: { text: 'world', id: 'text-1' },
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
        payload: { text: 'Hello world', id: 'text-1' },
      });
    });

    it('should use default batch size of 5', async () => {
      processor = new BatchPartsProcessor();

      const chunks = [
        { type: 'text-delta', payload: { text: 'A', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'B', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'C', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'D', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: 'E', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
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
        payload: { text: 'ABCDE', id: 'text-1' },
      });
    });

    it('should preserve id and runId from the first chunk when batching (regression #14890)', async () => {
      processor = new BatchPartsProcessor({ batchSize: 3 });

      const chunks: ChunkType[] = [
        {
          type: 'text-delta',
          payload: { text: 'Hello', id: 'msg_abc123' },
          runId: 'run_xyz789',
          from: ChunkFrom.AGENT,
        },
        {
          type: 'text-delta',
          payload: { text: ' ', id: 'msg_abc123' },
          runId: 'run_xyz789',
          from: ChunkFrom.AGENT,
        },
        {
          type: 'text-delta',
          payload: { text: 'world', id: 'msg_abc123' },
          runId: 'run_xyz789',
          from: ChunkFrom.AGENT,
        },
      ];

      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      for (let i = 0; i < 2; i++) {
        await processor.processOutputStream({
          part: chunks[i]!,
          streamParts: chunks.slice(0, i),
          state,
          abort: () => {
            throw new Error('abort');
          },
        });
      }

      const result = await processor.processOutputStream({
        part: chunks[2]!,
        streamParts: chunks.slice(0, 2),
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

      expect(result).toEqual({
        type: 'text-delta',
        runId: 'run_xyz789',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world', id: 'msg_abc123' },
      });
    });
  });

  describe('non-text chunks', () => {
    it('should emit immediately when non-text part is encountered (default behavior)', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      // Add some text chunks first
      const textChunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const textChunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: 'text-1' },
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
        payload: { text: 'Hello world', id: 'text-1' },
      });
    });

    it('should not emit immediately when emitOnNonText is false', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5, emitOnNonText: false });

      // Add some text chunks first
      const textChunk: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'text-1' },
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
        { type: 'text-delta', payload: { text: 'Hello', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' world', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: '!', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
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
        payload: { text: 'Hello', id: 'text-1' },
      });

      // Third chunk - should emit the deferred non-text part (object), buffer the text
      result = await processor.processOutputStream({
        part: chunks[2],
        streamParts: [chunks[2]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toEqual({
        type: 'object',
        object: { key: 'value' },
        runId: '1',
        from: ChunkFrom.AGENT,
      });

      // Fourth chunk - should not emit yet since batch size is 3 and we only have 2 chunks
      result = await processor.processOutputStream({
        part: chunks[3],
        streamParts: [chunks[3]],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });
      expect(result).toBeNull();
    });

    it('returns the batched text and stashes the non-text part for reprocessing (issue #17094)', async () => {
      processor = new BatchPartsProcessor({ batchSize: 10 });

      // A writer being present signals that we're running inside the processor
      // chain, so the non-text part is stashed for the runner to re-drive
      // through the chain rather than deferred to a next call that may never come.
      const writer = { custom: async () => {} };

      const chunks: ChunkType[] = [
        { type: 'text-delta', payload: { text: 'Hello', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' world', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT },
      ];

      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const abort = () => {
        throw new Error('abort');
      };

      // Buffer two text deltas (batch size not reached).
      expect(
        await processor.processOutputStream({ part: chunks[0], streamParts: [chunks[0]], state, abort, writer }),
      ).toBeNull();
      expect(
        await processor.processOutputStream({ part: chunks[1], streamParts: [chunks[1]], state, abort, writer }),
      ).toBeNull();

      // Non-text part arrives: the batched text is returned (so it flows through
      // downstream processors) and the non-text part is stashed under the
      // reprocess key for the runner to re-drive — NOT deferred — so nothing is
      // lost even if the stream stops on this part.
      const result = await processor.processOutputStream({
        part: chunks[2],
        streamParts: [chunks[2]],
        state,
        abort,
        writer,
      });

      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world', id: 'text-1' },
      });
      expect((state as Record<string, unknown>).__mastraReprocessPart).toEqual({
        type: 'object',
        object: { key: 'value' },
        runId: '1',
        from: ChunkFrom.AGENT,
      });
      // Nothing should be left in the legacy deferral field.
      expect((state as Record<string, unknown>).pendingNonText).toBeUndefined();
      expect(state.batch).toEqual([]);
    });
  });

  describe('timeout functionality', () => {
    it('should emit batch after maxWaitTime even if batch size not reached', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5, maxWaitTime: 1000 });

      const chunk1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: 'text-1' },
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
        payload: { text: '!', id: 'text-1' },
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
        payload: { text: 'Hello world!', id: 'text-1' },
      });
    });

    it('should not set timeout if maxWaitTime is not specified', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      const part: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'text-1' },
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
        payload: { text: ' world', id: 'text-1' },
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

    it('stashes the non-text part for reprocessing even when maxWaitTime is set (issue #17094)', async () => {
      // maxWaitTime must not interfere with the writer-present stash path: a
      // non-text part arriving before the timeout still flushes the batch and
      // stashes the non-text part rather than deferring it.
      processor = new BatchPartsProcessor({ batchSize: 10, maxWaitTime: 1000 });
      const writer = { custom: async () => {} };
      const abort = () => {
        throw new Error('abort');
      };

      const text1: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const text2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const nonText: ChunkType = { type: 'object', object: { key: 'value' }, runId: '1', from: ChunkFrom.AGENT };

      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      // Buffer two text deltas (this also arms the maxWaitTime timeout).
      expect(
        await processor.processOutputStream({ part: text1, streamParts: [text1], state, abort, writer }),
      ).toBeNull();
      expect(
        await processor.processOutputStream({ part: text2, streamParts: [text2], state, abort, writer }),
      ).toBeNull();

      // Non-text part arrives before the timeout fires: batch is returned and the
      // non-text part is stashed for reprocessing (not deferred).
      const result = await processor.processOutputStream({
        part: nonText,
        streamParts: [nonText],
        state,
        abort,
        writer,
      });

      expect(result).toEqual({
        type: 'text-delta',
        runId: '1',
        from: ChunkFrom.AGENT,
        payload: { text: 'Hello world', id: 'text-1' },
      });
      expect((state as Record<string, unknown>).__mastraReprocessPart).toEqual(nonText);
      expect((state as Record<string, unknown>).pendingNonText).toBeUndefined();
      // The pending timeout was cleared by the flush.
      expect(state.timeoutId).toBeUndefined();
    });
  });

  describe('flush functionality', () => {
    it('should flush remaining chunks when flush is called', async () => {
      processor = new BatchPartsProcessor({ batchSize: 5 });

      const chunks = [
        { type: 'text-delta', payload: { text: 'Hello', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        { type: 'text-delta', payload: { text: ' world', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
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
        payload: { text: 'Hello world', id: 'text-1' },
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
        payload: { text: 'Hello', id: 'text-1' },
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
        payload: { text: '', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const chunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: 'Hello', id: 'text-1' },
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
        payload: { text: 'Hello', id: 'text-1' },
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
        payload: { text: 'Hello', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const textChunk2: ChunkType = {
        type: 'text-delta',
        payload: { text: ' world', id: 'text-1' },
        runId: '1',
        from: ChunkFrom.AGENT,
      };
      const textChunk3: ChunkType = {
        type: 'text-delta',
        payload: { text: '!', id: 'text-1' },
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
        payload: { text: 'Hello world!', id: 'text-1' },
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

  describe('semantic stream windowing', () => {
    const textChunk = (text: string): ChunkType => ({
      type: 'text-delta',
      payload: { text, id: 'text-1' },
      runId: '1',
      from: ChunkFrom.AGENT,
    });

    const runPart = (processor: BatchPartsProcessor, part: ChunkType, state: BatchPartsState) =>
      processor.processOutputStream({
        part,
        streamParts: [part],
        state,
        abort: () => {
          throw new Error('abort');
        },
      });

    it('flushes each text chunk when checkEvery is chunk', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'chunk' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const result = await runPart(processor, textChunk('Hello'), state);

      expect(result).toMatchObject({ type: 'text-delta', payload: { text: 'Hello', id: 'text-1' } });
    });

    it('flushes at sentence boundaries across chunks and keeps unfinished text buffered', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'sentence' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      expect(await runPart(processor, textChunk('Hello'), state)).toBeNull();
      expect(await runPart(processor, textChunk(' world'), state)).toBeNull();
      const result = await runPart(processor, textChunk('. Next'), state);

      expect(result).toMatchObject({ type: 'text-delta', payload: { text: 'Hello world.', id: 'text-1' } });
      expect(state.batch).toHaveLength(1);
      expect(state.batch[0]).toMatchObject({ type: 'text-delta', payload: { text: ' Next', id: 'text-1' } });

      const second = await runPart(processor, textChunk(' sentence.'), state);
      expect(second).toMatchObject({ type: 'text-delta', payload: { text: ' Next sentence.', id: 'text-1' } });
    });

    it('does not split decimal numbers as sentence boundaries', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'sentence' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      expect(await runPart(processor, textChunk('The value is 3.14'), state)).toBeNull();
      const result = await runPart(processor, textChunk(' today.'), state);

      expect(result).toMatchObject({ type: 'text-delta', payload: { text: 'The value is 3.14 today.', id: 'text-1' } });
    });

    it('flushes markdown sections and fenced code blocks safely', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'section' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const markdown = '## Setup\n\nInstall the package.';
      const markdownResult = await runPart(processor, textChunk(markdown), state);
      expect(markdownResult).toMatchObject({ type: 'text-delta', payload: { text: markdown, id: 'text-1' } });

      const codeState: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };
      expect(await runPart(processor, textChunk('```ts\nconst x = 1;\n'), codeState)).toBeNull();
      const codeResult = await runPart(processor, textChunk('```'), codeState);
      expect(codeResult).toMatchObject({
        type: 'text-delta',
        payload: { text: '```ts\nconst x = 1;\n```', id: 'text-1' },
      });
    });

    it('flushes JSON-ish output only after the top-level structure is balanced', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'section' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      expect(await runPart(processor, textChunk('{"items":[{"value":"}"}'), state)).toBeNull();
      const result = await runPart(processor, textChunk(']} trailing'), state);

      expect(result).toMatchObject({
        type: 'text-delta',
        payload: { text: '{"items":[{"value":"}"}]}', id: 'text-1' },
      });
      expect(state.batch[0]).toMatchObject({ type: 'text-delta', payload: { text: ' trailing', id: 'text-1' } });
    });

    it('flushes completed markdown before the next heading', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'section' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const result = await runPart(processor, textChunk('## Setup\nInstall the package.\n## Usage\nRun it'), state);

      expect(result).toMatchObject({
        type: 'text-delta',
        payload: { text: '## Setup\nInstall the package.', id: 'text-1' },
      });
      expect(state.batch[0]).toMatchObject({
        type: 'text-delta',
        payload: { text: '\n## Usage\nRun it', id: 'text-1' },
      });
    });

    it('uses max segment fallback to avoid buffering indefinitely', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'sentence', maxSegmentChars: 10 });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const result = await runPart(processor, textChunk('abcdefghij'), state);

      expect(result).toMatchObject({ type: 'text-delta', payload: { text: 'abcdefghij', id: 'text-1' } });
    });

    it('attaches lookback as guardrail context without duplicating emitted text', async () => {
      processor = new BatchPartsProcessor({ checkEvery: 'sentence', lookback: 'short' });
      const state: BatchPartsState = { batch: [], timeoutId: undefined, timeoutTriggered: false };

      const first = await runPart(processor, textChunk('First sentence.'), state);
      const second = await runPart(processor, textChunk(' Second sentence.'), state);

      expect(first).toMatchObject({ type: 'text-delta', payload: { text: 'First sentence.', id: 'text-1' } });
      expect(second).toMatchObject({ type: 'text-delta', payload: { text: ' Second sentence.', id: 'text-1' } });
      expect((second as any)?.[BATCH_PARTS_GUARDRAIL_CONTEXT_KEY]).toBe('First sentence. Second sentence.');
      expect(second?.metadata).toBeUndefined();
      expect(JSON.stringify(second)).not.toContain('First sentence. Second sentence.');
    });
  });
});
