import { ReadableStream } from 'stream/web';
import type { ChunkType } from '@mastra/core/stream';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { processMastraStream } from './process-mastra-stream';

describe('processMastraStream', () => {
  let mockOnChunk: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChunk = vi.fn().mockResolvedValue(undefined);
    vi.clearAllMocks();
  });

  const createMockStream = (data: string): ReadableStream<Uint8Array> => {
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(data));
        controller.close();
      },
    });
  };

  const createChunkedMockStream = (chunks: string[]): ReadableStream<Uint8Array> => {
    let currentIndex = 0;
    return new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const pushNext = () => {
          if (currentIndex < chunks.length) {
            controller.enqueue(encoder.encode(chunks[currentIndex]));
            currentIndex++;
            // Simulate async processing
            setTimeout(pushNext, 10);
          } else {
            controller.close();
          }
        };

        pushNext();
      },
    });
  };

  it('should process valid SSE messages and call onChunk', async () => {
    const testChunk: ChunkType = {
      type: 'test',
      runId: 'run-123',
      from: 'agent',
      payload: { message: 'hello' },
    };

    const sseData = `data: ${JSON.stringify(testChunk)}\n\n`;
    const stream = createMockStream(sseData);

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(testChunk);
  });

  it('should process multiple SSE messages in sequence', async () => {
    const testChunk1: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'first message' },
    };

    const testChunk2: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'second message' },
    };

    const sseData = `data: ${JSON.stringify(testChunk1)}\n\ndata: ${JSON.stringify(testChunk2)}\n\n`;
    const stream = createMockStream(sseData);

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(2);
    expect(mockOnChunk).toHaveBeenNthCalledWith(1, testChunk1);
    expect(mockOnChunk).toHaveBeenNthCalledWith(2, testChunk2);
  });

  it('should handle [DONE] marker and terminate stream processing', async () => {
    const testChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'message before done' },
    };

    const sseData = `data: ${JSON.stringify(testChunk)}\n\ndata: [DONE]\n\n`;
    const stream = createMockStream(sseData);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(testChunk);
    expect(consoleSpy).toHaveBeenCalledWith('🏁 Stream finished');

    consoleSpy.mockRestore();
  });

  it('should handle JSON parsing errors gracefully', async () => {
    const invalidJson = 'data: {invalid json}\n\n';
    const validChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'valid message' },
    };
    const validData = `data: ${JSON.stringify(validChunk)}\n\n`;

    const sseData = invalidJson + validData;
    const stream = createMockStream(sseData);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    // Should have called onChunk only for the valid message
    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(validChunk);

    // Should have logged the JSON parsing error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ JSON parse error:',
      expect.any(SyntaxError),
      'Data:',
      '{invalid json}',
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle incomplete SSE messages across chunks', async () => {
    const testChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'complete message' },
    };

    // Split the SSE message across multiple chunks
    const chunks = [
      'data: {"type":"message","runId":"run-123"',
      ',"from":"agent","payload":{"text":"complete message"}}\n\n',
    ];

    const stream = createChunkedMockStream(chunks);

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(testChunk);
  });

  it('should handle empty stream', async () => {
    const stream = createMockStream('');

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).not.toHaveBeenCalled();
  });

  it('should ignore non-data lines', async () => {
    const testChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'valid message' },
    };

    // SSE format: each line ends with \n, and messages are separated by \n\n
    const sseData = `event: test-event\nid: 123\n\ndata: ${JSON.stringify(testChunk)}\n\nretry: 5000\n\n`;

    const stream = createMockStream(sseData);

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(testChunk);
  });

  it('should properly clean up stream reader resources', async () => {
    const testChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'test message' },
    };

    const sseData = `data: ${JSON.stringify(testChunk)}\n\n`;
    const stream = createMockStream(sseData);

    // Spy on the reader's releaseLock method
    const reader = stream.getReader();
    const releaseLockSpy = vi.spyOn(reader, 'releaseLock');
    reader.releaseLock(); // Release it so processMastraStream can get it

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    // The function should have called releaseLock in the finally block
    expect(releaseLockSpy).toHaveBeenCalled();
  });

  it('should handle onChunk errors by logging them as JSON parse errors', async () => {
    const testChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'first message' },
    };

    const sseData = `data: ${JSON.stringify(testChunk)}\n\n`;
    const stream = createMockStream(sseData);

    // Make the call to onChunk reject
    mockOnChunk.mockRejectedValueOnce(new Error('onChunk error'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw an error but handle it gracefully
    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(testChunk);

    // Should log the onChunk error as a JSON parse error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ JSON parse error:',
      expect.any(Error),
      'Data:',
      JSON.stringify(testChunk),
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle stream read errors', async () => {
    const errorMessage = 'Stream read error';
    const stream = new ReadableStream({
      start(controller) {
        controller.error(new Error(errorMessage));
      },
    });

    await expect(
      processMastraStream({
        stream,
        onChunk: mockOnChunk,
      }),
    ).rejects.toThrow(errorMessage);

    expect(mockOnChunk).not.toHaveBeenCalled();
  });

  it('should handle mixed valid and invalid data lines', async () => {
    const validChunk1: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'first valid message' },
    };

    const validChunk2: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'second valid message' },
    };

    const sseData = `data: ${JSON.stringify(validChunk1)}\n\ndata: {invalid json}\n\ndata: ${JSON.stringify(validChunk2)}\n\ndata: [DONE]\n\n`;

    const stream = createMockStream(sseData);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(2);
    expect(mockOnChunk).toHaveBeenNthCalledWith(1, validChunk1);
    expect(mockOnChunk).toHaveBeenNthCalledWith(2, validChunk2);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '❌ JSON parse error:',
      expect.any(SyntaxError),
      'Data:',
      '{invalid json}',
    );
    expect(consoleSpy).toHaveBeenCalledWith('🏁 Stream finished');

    consoleErrorSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('should handle data lines without "data: " prefix', async () => {
    const testChunk: ChunkType = {
      type: 'message',
      runId: 'run-123',
      from: 'agent',
      payload: { text: 'valid message' },
    };

    const sseData = `some random line\n\ndata: ${JSON.stringify(testChunk)}\n\nanother line without prefix\n\n`;

    const stream = createMockStream(sseData);

    await processMastraStream({
      stream,
      onChunk: mockOnChunk,
    });

    expect(mockOnChunk).toHaveBeenCalledTimes(1);
    expect(mockOnChunk).toHaveBeenCalledWith(testChunk);
  });
});
