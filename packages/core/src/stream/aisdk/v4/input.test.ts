import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { describe, it, expect } from 'vitest';
import { RegisteredLogger } from '../../../logger';
import { ChunkFrom } from '../../types';
import { AISDKV4InputStream } from './input';

describe('AISDKV4InputStream', () => {
  it('should transform AI SDK v4 stream chunks to Mastra format', async () => {
    // Create the input stream instance
    const inputStream = new AISDKV4InputStream({
      component: RegisteredLogger.LLM,
      name: 'test-stream',
    });

    const mockModel = new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Hello' },
            { type: 'text-delta', textDelta: ' from' },
            { type: 'text-delta', textDelta: ' agent' },
            {
              type: 'finish',
              finishReason: 'stop',
              logprobs: undefined,
              usage: { completionTokens: 3, promptTokens: 10 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const stream = await inputStream.initialize({
      runId: 'test-run-123',
      createStream: async () => {
        const result = await mockModel.doStream({
          inputFormat: 'prompt',
          mode: { type: 'regular' },
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        });
        return {
          stream: result.stream,
          warnings: {},
          request: result.rawCall,
          rawResponse: result.rawCall,
        };
      },
      onResult: () => {},
    });

    // Collect chunks from the returned stream
    const capturedChunks: any[] = [];
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        capturedChunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Verify the chunks were transformed correctly
    expect(capturedChunks).toHaveLength(4);

    // Check first text-delta chunk
    expect(capturedChunks[0]).toEqual({
      type: 'text-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        text: 'Hello',
      },
    });

    // Check second text-delta chunk
    expect(capturedChunks[1]).toEqual({
      type: 'text-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        text: ' from',
      },
    });

    // Check third text-delta chunk
    expect(capturedChunks[2]).toEqual({
      type: 'text-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        text: ' agent',
      },
    });

    // Check finish chunk
    expect(capturedChunks[3]).toEqual({
      type: 'finish',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        usage: { completionTokens: 3, promptTokens: 10 },
        providerMetadata: undefined,
      },
    });
  });
});
