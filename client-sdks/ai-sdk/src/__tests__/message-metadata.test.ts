import type { MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it, vi } from 'vitest';
import { toAISdkV5Stream } from '../convert-streams';

describe('messageMetadata', () => {
  it('should call messageMetadata function with the correct part for start chunk', async () => {
    const messageMetadataFn = vi.fn(({ part }) => ({
      customField: 'test-value',
      partType: part.type,
    }));

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'start',
          runId: 'test-run-id',
          payload: { id: 'test-id' },
        });

        controller.enqueue({
          type: 'text-start',
          runId: 'test-run-id',
          payload: {
            id: 'text-id-1',
            providerMetadata: undefined,
          },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
      from: 'agent',
      sendStart: true,
      messageMetadata: messageMetadataFn,
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // Verify messageMetadata was called
    expect(messageMetadataFn).toHaveBeenCalled();

    // Find the start chunk
    const startChunk = chunks.find(chunk => chunk.type === 'start');
    expect(startChunk).toBeDefined();
    expect(startChunk.messageMetadata).toBeDefined();
    expect(startChunk.messageMetadata.customField).toBe('test-value');
    expect(startChunk.messageMetadata.partType).toBe('start');
  });

  it('should include messageMetadata in finish chunk', async () => {
    const messageMetadataFn = vi.fn(({ part }) => ({
      sessionId: 'session-123',
      userId: 'user-456',
      partType: part.type,
    }));

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'start',
          runId: 'test-run-id',
          payload: { id: 'test-id' },
        });

        controller.enqueue({
          type: 'finish',
          runId: 'test-run-id',
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: {
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
              },
            },
          },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
      from: 'agent',
      sendFinish: true,
      messageMetadata: messageMetadataFn,
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // Find the finish chunk
    const finishChunk = chunks.find(chunk => chunk.type === 'finish');
    expect(finishChunk).toBeDefined();
    expect(finishChunk.messageMetadata).toBeDefined();
    expect(finishChunk.messageMetadata.sessionId).toBe('session-123');
    expect(finishChunk.messageMetadata.userId).toBe('user-456');
  });

  it('should call messageMetadata for each part in the stream', async () => {
    const messageMetadataFn = vi.fn(({ part }) => ({
      partType: part.type,
      timestamp: Date.now(),
    }));

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'start',
          runId: 'test-run-id',
          payload: { id: 'test-id' },
        });

        controller.enqueue({
          type: 'text-start',
          runId: 'test-run-id',
          payload: {
            id: 'text-id-1',
            providerMetadata: undefined,
          },
        });

        controller.enqueue({
          type: 'text-delta',
          runId: 'test-run-id',
          payload: {
            id: 'text-id-1',
            text: 'Hello',
            providerMetadata: undefined,
          },
        });

        controller.enqueue({
          type: 'finish',
          runId: 'test-run-id',
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: {
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
              },
            },
          },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
      from: 'agent',
      sendStart: true,
      sendFinish: true,
      messageMetadata: messageMetadataFn,
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // messageMetadata should be called for each part that gets converted
    expect(messageMetadataFn).toHaveBeenCalled();

    // Verify start chunk has metadata
    const startChunk = chunks.find(chunk => chunk.type === 'start');
    expect(startChunk?.messageMetadata).toBeDefined();

    // Verify finish chunk has metadata
    const finishChunk = chunks.find(chunk => chunk.type === 'finish');
    expect(finishChunk?.messageMetadata).toBeDefined();
  });

  it('should not include messageMetadata when function is not provided', async () => {
    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'start',
          runId: 'test-run-id',
          payload: { id: 'test-id' },
        });

        controller.enqueue({
          type: 'finish',
          runId: 'test-run-id',
          payload: {
            stepResult: {
              reason: 'stop',
            },
            output: {
              usage: {
                inputTokens: 10,
                outputTokens: 20,
                totalTokens: 30,
              },
            },
          },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
      from: 'agent',
      sendStart: true,
      sendFinish: true,
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // Verify start chunk does not have metadata
    const startChunk = chunks.find(chunk => chunk.type === 'start');
    expect(startChunk).toBeDefined();
    expect(startChunk.messageMetadata).toBeUndefined();

    // Verify finish chunk does not have metadata
    const finishChunk = chunks.find(chunk => chunk.type === 'finish');
    expect(finishChunk).toBeDefined();
    expect(finishChunk.messageMetadata).toBeUndefined();
  });

  it('should handle messageMetadata returning null or undefined', async () => {
    const messageMetadataFn = vi.fn(() => null);

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'start',
          runId: 'test-run-id',
          payload: { id: 'test-id' },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
      from: 'agent',
      sendStart: true,
      messageMetadata: messageMetadataFn,
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    const startChunk = chunks.find(chunk => chunk.type === 'start');
    expect(startChunk).toBeDefined();
    // When messageMetadata returns null, it should not be included
    expect(startChunk.messageMetadata).toBeUndefined();
  });

  it('should pass the correct part to messageMetadata function', async () => {
    const messageMetadataFn = vi.fn(({ part }) => {
      expect(part).toBeDefined();
      expect(part.type).toBeDefined();
      return { partType: part.type };
    });

    const mockStream = new ReadableStream({
      async start(controller) {
        controller.enqueue({
          type: 'start',
          runId: 'test-run-id',
          payload: { id: 'test-id' },
        });

        controller.enqueue({
          type: 'text-start',
          runId: 'test-run-id',
          payload: {
            id: 'text-id-1',
            providerMetadata: undefined,
          },
        });

        controller.close();
      },
    });

    const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, {
      from: 'agent',
      sendStart: true,
      messageMetadata: messageMetadataFn,
    });

    const chunks: any[] = [];
    for await (const chunk of aiSdkStream) {
      chunks.push(chunk);
    }

    // Verify the function was called with the correct structure
    expect(messageMetadataFn).toHaveBeenCalled();
    const callArgs = messageMetadataFn.mock.calls[0][0];
    expect(callArgs).toHaveProperty('part');
    expect(callArgs.part).toHaveProperty('type');
  });
});
