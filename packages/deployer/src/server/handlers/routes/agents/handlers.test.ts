/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { ChunkType } from '@mastra/core/stream';
import { ChunkFrom } from '@mastra/core/stream';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as handlers from './handlers';

describe('Stream Error Handling for Rate Limits and Provider Errors', () => {
  let mockMastra: Mastra;
  let mockAgent: Agent;
  let mockContext: Partial<Context>;
  let mockLogger: any;
  let originalStreamGenerateHandler: typeof handlers.streamGenerateHandler;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      getTransports: vi.fn(() => []),
      getLogs: vi.fn(() => []),
      getLogsByRunId: vi.fn(() => []),
      trackException: vi.fn(),
    };

    mockAgent = {} as Agent;
    mockAgent.name = 'test-agent';
    mockAgent.stream = vi.fn();

    mockMastra = {
      getAgent: vi.fn((id: string) => (id === 'test-agent' ? mockAgent : undefined)),
      getLogger: vi.fn(() => mockLogger),
    } as any;

    mockContext = {
      req: {
        param: vi.fn((key: string) => (key === 'agentId' ? 'test-agent' : undefined)),
        json: vi.fn().mockResolvedValue({
          messages: [{ role: 'user', content: 'test message' }],
          runId: 'test-run-id',
        }),
        raw: {
          signal: new AbortController().signal,
        } as any,
      } as any,
      get: vi.fn((key: string) => {
        if (key === 'mastra') return mockMastra;
        if (key === 'runtimeContext') return new RuntimeContext();
        return undefined;
      }),
      header: vi.fn(),
      json: vi.fn((data: any, status?: number) => {
        return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any,
      newResponse: vi.fn((body: any, init?: any) => {
        return new Response(body, init);
      }) as any,
    };

    originalStreamGenerateHandler = handlers.streamGenerateHandler;
  });

  describe('Early Error Detection (before stream starts)', () => {
    it('should return HTTP 429 status when rate limit error occurs before streaming', async () => {
      const rateLimitError = new Error(
        'This request would exceed the rate limit for your organization of 30,000 input tokens per minute.',
      );
      rateLimitError.name = 'AI_APICallError';
      (rateLimitError as any).status = 429;

      (mockAgent.stream as any).mockRejectedValue(rateLimitError);

      try {
        await originalStreamGenerateHandler(mockContext as Context);
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        const httpException = error as HTTPException;
        expect(httpException.status).toBe(429);
        expect(httpException.message).toContain('rate limit');
      }
    });

    it('should return HTTP 500 status when generic provider error occurs before streaming', async () => {
      const apiError = new Error('Anthropic API error: Internal server error');
      apiError.name = 'AI_APICallError';
      (apiError as any).status = 500;

      (mockAgent.stream as any).mockRejectedValue(apiError);

      try {
        await originalStreamGenerateHandler(mockContext as Context);
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        const httpException = error as HTTPException;
        expect(httpException.status).toBe(500);
      }
    });

    it('should return HTTP 401 status when authentication error occurs', async () => {
      const authError = new Error('Invalid API key provided');
      authError.name = 'AI_APICallError';
      (authError as any).status = 401;

      (mockAgent.stream as any).mockRejectedValue(authError);

      try {
        await originalStreamGenerateHandler(mockContext as Context);
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        const httpException = error as HTTPException;
        expect(httpException.status).toBe(401);
      }
    });

    it('should not return 200 OK when rate limit error occurs', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'AI_APICallError';
      (rateLimitError as any).status = 429;

      (mockAgent.stream as any).mockRejectedValue(rateLimitError);

      try {
        await originalStreamGenerateHandler(mockContext as Context);
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        const httpException = error as HTTPException;
        expect(httpException.status).not.toBe(200);
        expect(httpException.status).toBe(429);
      }
    });
  });

  describe('Mid-Stream Error Handling (error during streaming)', () => {
    it('should emit error chunk when rate limit error occurs during streaming', async () => {
      const rateLimitError = new Error(
        'This request would exceed the rate limit for your organization of 30,000 input tokens per minute.',
      );
      rateLimitError.name = 'AI_APICallError';
      (rateLimitError as any).stack = 'Error stack trace';

      let readCount = 0;
      const mockReader = {
        read: vi.fn(async () => {
          readCount++;
          if (readCount === 1) {
            return { done: false, value: { type: 'text-delta', payload: { text: 'Hello' } } };
          } else if (readCount === 2) {
            return { done: false, value: { type: 'text-delta', payload: { text: ' World' } } };
          } else if (readCount === 3) {
            throw rateLimitError;
          }
          return { done: true, value: undefined };
        }),
        cancel: vi.fn(),
      };

      const mockFullStream = {
        getReader: vi.fn(() => mockReader),
      };

      (mockAgent.stream as any).mockResolvedValue({
        fullStream: mockFullStream,
      });

      const response = await originalStreamGenerateHandler(mockContext as Context);

      expect(response).toBeDefined();

      const reader = response!.body!.getReader();
      const decoder = new TextDecoder();
      let chunks: string[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        // Stream may close after error
      }

      const fullText = chunks.join('');
      const lines = fullText.split('\n\n').filter(line => line.trim().startsWith('data:'));

      const errorChunk = lines.find(line => {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          return data.type === 'error';
        } catch {
          return false;
        }
      });

      expect(errorChunk).toBeDefined();

      const errorData = JSON.parse(errorChunk!.replace('data: ', ''));
      expect(errorData.type).toBe('error');
      expect(errorData.payload.error).toBeDefined();

      const errorMessage =
        typeof errorData.payload.error === 'string'
          ? errorData.payload.error
          : errorData.payload.error.message || JSON.stringify(errorData.payload.error);

      expect(errorMessage).toContain('rate limit');
    });

    it('should emit error chunk with proper Mastra ChunkType structure', async () => {
      const providerError = new Error('Provider temporarily unavailable');
      providerError.name = 'AI_APICallError';
      (providerError as any).stack = 'Test stack trace';

      let readCount = 0;
      const mockReader = {
        read: vi.fn(async () => {
          readCount++;
          if (readCount === 1) {
            return { done: false, value: { type: 'text-delta', payload: { text: 'Starting' } } };
          } else if (readCount === 2) {
            throw providerError;
          }
          return { done: true, value: undefined };
        }),
        cancel: vi.fn(),
      };

      const mockFullStream = {
        getReader: vi.fn(() => mockReader),
      };

      (mockAgent.stream as any).mockResolvedValue({
        fullStream: mockFullStream,
      });

      const response = await originalStreamGenerateHandler(mockContext as Context);

      expect(response).toBeDefined();

      const reader = response!.body!.getReader();
      const decoder = new TextDecoder();
      let chunks: string[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        // Expected to finish
      }

      const fullText = chunks.join('');
      const lines = fullText.split('\n\n').filter(line => line.trim().startsWith('data:'));

      const errorChunk = lines.find(line => {
        try {
          const data = JSON.parse(line.replace('data: ', ''));
          return data.type === 'error';
        } catch {
          return false;
        }
      });

      expect(errorChunk).toBeDefined();

      const errorData = JSON.parse(errorChunk!.replace('data: ', ''));

      // Verify Mastra ChunkType structure
      expect(errorData.type).toBe('error');
      expect(errorData.from).toBe(ChunkFrom.AGENT);
      expect(errorData.runId).toBe('test-run-id');
      expect(errorData.payload).toBeDefined();

      // Verify error details
      expect(errorData.payload.error).toHaveProperty('message');
      expect(errorData.payload.error).toHaveProperty('name', 'AI_APICallError');
      expect(errorData.payload.error).toHaveProperty('stack');
    });

    it('should close stream gracefully after emitting error chunk', async () => {
      const streamError = new Error('Stream interrupted');
      streamError.name = 'StreamError';
      (streamError as any).stack = 'Stream error stack';

      let readCount = 0;
      const mockReader = {
        read: vi.fn(async () => {
          readCount++;
          if (readCount === 1) {
            return { done: false, value: { type: 'text-delta', payload: { text: 'Test' } } };
          } else if (readCount === 2) {
            throw streamError;
          }
          return { done: true, value: undefined };
        }),
        cancel: vi.fn(),
      };

      const mockFullStream = {
        getReader: vi.fn(() => mockReader),
      };

      (mockAgent.stream as any).mockResolvedValue({
        fullStream: mockFullStream,
      });

      const response = await originalStreamGenerateHandler(mockContext as Context);

      expect(response).toBeDefined();

      const reader = response!.body!.getReader();
      const decoder = new TextDecoder();
      let streamClosed = false;
      let chunks: string[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamClosed = true;
            break;
          }
          chunks.push(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        // Should not throw, stream should close gracefully
        streamClosed = true;
      }

      expect(streamClosed).toBe(true);

      // Verify error chunk was emitted before closing
      const fullText = chunks.join('');
      const hasErrorChunk = fullText.includes('"type":"error"') || fullText.includes('"type": "error"');
      expect(hasErrorChunk).toBe(true);
    });
  });
});
