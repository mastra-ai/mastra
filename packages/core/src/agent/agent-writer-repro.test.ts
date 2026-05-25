/**
 * Reproduction test for writer being undefined in processOutputStream.
 *
 * Tests every chunk type that flows through processOutputStream to verify
 * writer is always defined. This covers the full agent.stream() path
 * (handleChatStream → agent.stream() → workflowLoopStream → MastraModelOutput).
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import type { Processor, ProcessorStreamWriter } from '../processors/index';
import type { ChunkType } from '../stream/types';
import { Agent } from './index';

describe('writer availability in processOutputStream (end-to-end)', () => {
  it('should pass a defined writer for every chunk type during agent.stream()', async () => {
    const writerByChunkType = new Map<string, ProcessorStreamWriter | undefined>();

    class WriterCaptureProcessor implements Processor {
      readonly id = 'writer-capture';
      readonly name = 'Writer Capture';

      async processOutputStream({ part, writer }: { part: ChunkType; writer?: ProcessorStreamWriter }) {
        // Record the writer value for each chunk type we see
        writerByChunkType.set(part.type, writer);
        return part;
      }
    }

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Hello world' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: [], rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'Test agent',
      model: mockModel as any,
      outputProcessors: [new WriterCaptureProcessor()],
    });

    const stream = await agent.stream('test message');

    // Consume the full stream
    for await (const _chunk of stream.fullStream) {
      // just consume
    }

    // Verify we actually saw chunks
    expect(writerByChunkType.size).toBeGreaterThan(0);

    // Log status for each chunk type
    for (const [chunkType, writer] of writerByChunkType) {
      console.log(`  ${chunkType}: writer=${writer ? 'DEFINED' : 'UNDEFINED'}`);
    }

    // Check writer is defined for EVERY chunk type that went through processOutputStream
    for (const [chunkType, writer] of writerByChunkType) {
      expect(writer, `writer should be defined for chunk type "${chunkType}"`).toBeDefined();
      expect(typeof writer!.custom, `writer.custom should be a function for chunk type "${chunkType}"`).toBe(
        'function',
      );
    }

    // Log which chunk types we verified (useful for debugging)
    console.log('Chunk types verified with writer:', [...writerByChunkType.keys()]);
  });
});
