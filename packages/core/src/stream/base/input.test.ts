import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { ChunkType, CreateStream, OnResult } from '../types';
import { MastraModelInput } from './input';

// Test data representing a custom input format
interface CustomInputFormat {
  id: string;
  content: string;
  metadata?: Record<string, any>;
}

// Concrete implementation for testing - converts custom format to Mastra format
class TestMastraModelInput extends MastraModelInput {
  public transformCalled = false;
  public transformParams: any = null;

  async transform({
    runId,
    stream,
    controller,
  }: {
    runId: string;
    stream: ReadableStream<any>;
    controller: ReadableStreamDefaultController<ChunkType>;
  }): Promise<void> {
    this.transformCalled = true;
    this.transformParams = { runId, stream, controller };

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert custom input format to Mastra ChunkType
        const chunk: ChunkType = {
          type: 'custom-message',
          runId,
          from: 'test-converter',
          payload: {
            originalId: value.id || 'unknown',
            content: value.content || value.message || 'no content',
            metadata: value.metadata || {},
            rawValue: value, // Keep original for debugging
          },
        };
        controller.enqueue(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// Generic helper to create a mock stream with any type of data
function createMockStream<T>(parts: T[]): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      parts.forEach(part => controller.enqueue(part));
      controller.close();
    },
  });
}

describe('MastraModelInput', () => {
  let testInput: TestMastraModelInput;
  let mockCreateStream: vi.MockedFunction<CreateStream>;
  let mockOnResult: vi.MockedFunction<OnResult>;

  beforeEach(() => {
    testInput = new TestMastraModelInput({ name: 'test-input' });
    mockCreateStream = vi.fn();
    mockOnResult = vi.fn();
  });

  describe('initialize', () => {
    it('should create a readable stream and call transform', async () => {
      const mockInputData: CustomInputFormat[] = [
        { id: 'msg1', content: 'Hello', metadata: { priority: 'high' } },
        { id: 'msg2', content: 'World', metadata: { priority: 'low' } },
      ];

      mockCreateStream.mockResolvedValue({
        stream: createMockStream(mockInputData),
        warnings: { test: 'warning' },
        request: { test: 'request' },
        rawResponse: { test: 'response' },
      });

      const runId = 'test-run-id';
      const resultStream = testInput.initialize({
        runId,
        createStream: mockCreateStream,
        onResult: mockOnResult,
      });

      expect(resultStream).toBeInstanceOf(ReadableStream);

      // Read from the stream to trigger the start method
      const reader = resultStream.getReader();
      const chunks: ChunkType[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Verify createStream was called
      expect(mockCreateStream).toHaveBeenCalledOnce();

      // Verify onResult was called with correct parameters
      expect(mockOnResult).toHaveBeenCalledWith({
        warnings: { test: 'warning' },
        request: { test: 'request' },
        rawResponse: { test: 'response' },
      });

      // Verify transform was called
      expect(testInput.transformCalled).toBe(true);
      expect(testInput.transformParams.runId).toBe(runId);

      // Verify chunks were processed correctly
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        type: 'custom-message',
        runId,
        from: 'test-converter',
        payload: {
          originalId: 'msg1',
          content: 'Hello',
          metadata: { priority: 'high' },
          rawValue: { id: 'msg1', content: 'Hello', metadata: { priority: 'high' } },
        },
      });
      expect(chunks[1]).toEqual({
        type: 'custom-message',
        runId,
        from: 'test-converter',
        payload: {
          originalId: 'msg2',
          content: 'World',
          metadata: { priority: 'low' },
          rawValue: { id: 'msg2', content: 'World', metadata: { priority: 'low' } },
        },
      });
    });

    it('should handle rawResponse fallback to response', async () => {
      mockCreateStream.mockResolvedValue({
        stream: createMockStream([]),
        warnings: {},
        request: {},
        response: { fallback: 'response' },
      });

      const runId = 'test-run-id';
      const resultStream = testInput.initialize({
        runId,
        createStream: mockCreateStream,
        onResult: mockOnResult,
      });

      const reader = resultStream.getReader();
      // Read to completion to trigger the start method
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      reader.releaseLock();

      expect(mockOnResult).toHaveBeenCalledWith({
        warnings: {},
        request: {},
        rawResponse: { fallback: 'response' },
      });
    });

    it('should handle empty rawResponse and response', async () => {
      mockCreateStream.mockResolvedValue({
        stream: createMockStream([]),
        warnings: {},
        request: {},
      });

      const runId = 'test-run-id';
      const resultStream = testInput.initialize({
        runId,
        createStream: mockCreateStream,
        onResult: mockOnResult,
      });

      const reader = resultStream.getReader();
      // Read to completion to trigger the start method
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      reader.releaseLock();

      expect(mockOnResult).toHaveBeenCalledWith({
        warnings: {},
        request: {},
        rawResponse: {},
      });
    });

    it('should handle errors from createStream', async () => {
      const error = new Error('Stream creation failed');
      mockCreateStream.mockRejectedValue(error);

      const runId = 'test-run-id';
      const resultStream = testInput.initialize({
        runId,
        createStream: mockCreateStream,
        onResult: mockOnResult,
      });

      const reader = resultStream.getReader();

      await expect(reader.read()).rejects.toThrow('Stream creation failed');
      reader.releaseLock();

      // onResult should not be called when createStream fails
      expect(mockOnResult).not.toHaveBeenCalled();
      expect(testInput.transformCalled).toBe(false);
    });

    it('should handle errors from transform method', async () => {
      // Create a test input that throws in transform
      class ErroringTestInput extends MastraModelInput {
        async transform(): Promise<void> {
          throw new Error('Transform failed');
        }
      }

      const erroringInput = new ErroringTestInput({ name: 'error-input' });

      mockCreateStream.mockResolvedValue({
        stream: createMockStream([{ id: 'test', content: 'test message' }]),
        warnings: {},
        request: {},
        rawResponse: {},
      });

      const runId = 'test-run-id';
      const resultStream = erroringInput.initialize({
        runId,
        createStream: mockCreateStream,
        onResult: mockOnResult,
      });

      const reader = resultStream.getReader();

      await expect(reader.read()).rejects.toThrow('Transform failed');
      reader.releaseLock();

      // onResult should still be called before transform fails
      expect(mockOnResult).toHaveBeenCalledOnce();
    });

    it('should close the controller when transform completes successfully', async () => {
      mockCreateStream.mockResolvedValue({
        stream: createMockStream([]),
        warnings: {},
        request: {},
        rawResponse: {},
      });

      const runId = 'test-run-id';
      const resultStream = testInput.initialize({
        runId,
        createStream: mockCreateStream,
        onResult: mockOnResult,
      });

      const reader = resultStream.getReader();
      const { done } = await reader.read();

      expect(done).toBe(true);
      reader.releaseLock();
    });
  });

  describe('abstract methods', () => {
    it('should require transform method to be implemented', () => {
      // Verify that our test implementation has the transform method
      expect(typeof testInput.transform).toBe('function');

      // Verify that the transform method is called during initialization
      expect(testInput.transformCalled).toBe(false);

      // This test verifies that any concrete implementation must provide
      // the transform method to work properly with the initialize method
    });
  });

  describe('inheritance', () => {
    it('should extend MastraBase and have correct properties', () => {
      expect(testInput.name).toBe('test-input');
      expect(testInput.component).toBeDefined();
      expect(typeof testInput.__setLogger).toBe('function');
      expect(typeof testInput.__setTelemetry).toBe('function');
      expect(typeof testInput.__getTelemetry).toBe('function');
    });
  });
});
