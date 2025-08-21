import { describe, it, expect } from 'vitest';
import { RegisteredLogger } from '../../../logger';
import { ChunkFrom } from '../../types';
import { AISDKV5InputStream } from './input';
import { createTestModel } from './test-utils';

describe('AISDKV5InputStream', () => {
  it('should transform AI SDK v5 stream chunks to Mastra format', async () => {
    // Create the input stream instance
    const inputStream = new AISDKV5InputStream({
      component: RegisteredLogger.LLM,
      name: 'test-stream',
    });

    const mockModel = createTestModel();

    const stream = inputStream.initialize({
      runId: 'test-run-123',
      createStream: async () => {
        const result = await mockModel.doStream({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        });
        return {
          stream: result.stream,
          warnings: {},
          request: result.request || {},
          rawResponse: result.response || {},
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

    // Verify that we captured all expected chunks (response-metadata + reasoning-start + 2 reasoning-delta + reasoning-end + source + file + tool-call + tool-result + tool-input-start + 2 tool-input-delta + tool-input-end + text-start + 3 text-delta + text-end + finish)
    expect(capturedChunks.length).toBe(19);

    // Check response-metadata chunk
    expect(capturedChunks[0]).toEqual({
      type: 'response-metadata',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock-model-id',
        timestamp: new Date(0),
      },
    });

    // Check reasoning-start chunk
    expect(capturedChunks[1]).toEqual({
      type: 'reasoning-start',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'reasoning-1',
        providerMetadata: undefined,
      },
    });

    // Check reasoning-delta chunks
    expect(capturedChunks[2]).toEqual({
      type: 'reasoning-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'reasoning-1',
        providerMetadata: undefined,
        text: 'I need to think about this...',
      },
    });

    expect(capturedChunks[3]).toEqual({
      type: 'reasoning-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'reasoning-1',
        providerMetadata: undefined,
        text: ' Let me process the request.',
      },
    });

    // Check reasoning-end chunk
    expect(capturedChunks[4]).toEqual({
      type: 'reasoning-end',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'reasoning-1',
        providerMetadata: undefined,
      },
    });

    // Check source chunk
    expect(capturedChunks[5]).toEqual({
      type: 'source',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: 'source-1',
        sourceType: 'url',
        title: 'Example Article',
        mimeType: undefined,
        filename: undefined,
        url: 'https://example.com/article',
        providerMetadata: undefined,
      },
    });

    // Check file chunk
    expect(capturedChunks[6]).toEqual({
      type: 'file',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
      },
    });

    // Check tool-call chunk
    expect(capturedChunks[7]).toEqual({
      type: 'tool-call',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'call-1',
        toolName: 'get_weather',
        args: { location: 'New York', unit: 'celsius' },
        providerExecuted: false,
        providerMetadata: undefined,
      },
    });

    // Check tool-result chunk
    expect(capturedChunks[8]).toEqual({
      type: 'tool-result',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'call-1',
        toolName: 'get_weather',
        result: { temperature: 22, condition: 'sunny', humidity: 65 },
        isError: false,
        providerExecuted: false,
        providerMetadata: undefined,
      },
    });

    // Check tool-input-start chunk
    expect(capturedChunks[9]).toEqual({
      type: 'tool-call-input-streaming-start',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'input-1',
        toolName: 'calculate_sum',
        providerExecuted: false,
        providerMetadata: undefined,
      },
    });

    // Check tool-input-delta chunks
    expect(capturedChunks[10]).toEqual({
      type: 'tool-call-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        argsTextDelta: '{"a": 5, ',
        toolCallId: 'input-1',
        providerMetadata: undefined,
      },
    });

    expect(capturedChunks[11]).toEqual({
      type: 'tool-call-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        argsTextDelta: '"b": 10}',
        toolCallId: 'input-1',
        providerMetadata: undefined,
      },
    });

    // Check tool-input-end chunk
    expect(capturedChunks[12]).toEqual({
      type: 'tool-call-input-streaming-end',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'input-1',
        providerMetadata: undefined,
      },
    });

    // Check text-start chunk
    expect(capturedChunks[13]).toEqual({
      type: 'text-start',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: '1',
        providerMetadata: undefined,
      },
    });

    // Check the text-delta chunks
    expect(capturedChunks[14]).toEqual({
      type: 'text-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: '1',
        providerMetadata: undefined,
        text: 'Hello',
      },
    });

    expect(capturedChunks[15]).toEqual({
      type: 'text-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: '1',
        providerMetadata: undefined,
        text: ', ',
      },
    });

    expect(capturedChunks[16]).toEqual({
      type: 'text-delta',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        id: '1',
        providerMetadata: undefined,
        text: 'world!',
      },
    });

    // Check text-end chunk
    expect(capturedChunks[17]).toEqual({
      type: 'text-end',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        type: 'text-end',
        id: '1',
      },
    });

    // Check custom finish chunk
    expect(capturedChunks[18]).toEqual({
      type: 'finish',
      runId: 'test-run-123',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: {
          reason: 'stop',
        },
        output: {
          usage: {
            inputTokens: 3,
            outputTokens: 10,
            totalTokens: 13,
          },
        },
        metadata: {
          providerMetadata: {
            testProvider: {
              testKey: 'testValue',
            },
          },
        },
        type: 'finish',
      },
    });
  });
});
