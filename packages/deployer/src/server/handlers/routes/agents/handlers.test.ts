/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { ChunkFrom } from '@mastra/core/stream';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as handlers from './handlers';

/**
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-api-call-error
 */
interface AI_APICallErrorOptions {
  message: string;
  statusCode?: number;
  url?: string;
  requestBodyValues?: Record<string, any>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  isRetryable?: boolean;
  data?: any;
}

function createAI_APICallError(options: AI_APICallErrorOptions): Error {
  const error = new Error(options.message);
  error.name = 'AI_APICallError';
  (error as any).status = options.statusCode;
  (error as any).statusCode = options.statusCode;
  (error as any).url = options.url;
  (error as any).requestBodyValues = options.requestBodyValues;
  (error as any).responseHeaders = options.responseHeaders;
  (error as any).responseBody = options.responseBody;
  (error as any).isRetryable = options.isRetryable ?? (options.statusCode ? options.statusCode >= 500 : false);
  (error as any).data = options.data;
  return error;
}

async function readStreamChunks(response: Response): Promise<string[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } catch (e) {
    // Stream may close after error
  }

  return chunks;
}

function findErrorChunk(chunks: string[]): any | undefined {
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

  return errorChunk ? JSON.parse(errorChunk.replace('data: ', '')) : undefined;
}

async function expectHTTPException(fn: () => Promise<any>, expectedStatus: number, expectedMessagePart?: string) {
  try {
    await fn();
    expect.fail('Should have thrown HTTPException');
  } catch (error) {
    expect(error).toBeInstanceOf(HTTPException);
    const httpException = error as HTTPException;
    expect(httpException.status).toBe(expectedStatus);
    if (expectedMessagePart) {
      expect(httpException.message).toContain(expectedMessagePart);
    }
  }
}

describe('Handlers', () => {
  let mockMastra: Mastra;
  let mockAgent: Agent;
  let mockContext: Partial<Context>;
  let mockLogger: any;
  let originalStreamGenerateHandler: typeof handlers.streamGenerateHandler;
  let originalApproveToolCallHandler: typeof handlers.approveToolCallHandler;
  let originalDeclineToolCallHandler: typeof handlers.declineToolCallHandler;
  let originalStreamNetworkHandler: typeof handlers.streamNetworkHandler;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      getTransports: vi.fn(() => []),
      listLogs: vi.fn(() => []),
      listLogsByRunId: vi.fn(() => []),
      trackException: vi.fn(),
    };

    mockAgent = {} as Agent;
    mockAgent.name = 'test-agent';
    mockAgent.stream = vi.fn();
    mockAgent.approveToolCall = vi.fn();
    mockAgent.declineToolCall = vi.fn();
    mockAgent.network = vi.fn();
    mockAgent.getMemory = vi.fn();

    mockMastra = {
      getAgent: vi.fn((id: string) => (id === 'test-agent' ? mockAgent : undefined)),
      getAgentById: vi.fn((id: string) => (id === 'test-agent' ? mockAgent : undefined)),
      getLogger: vi.fn(() => mockLogger),
      listAgents: vi.fn(() => [mockAgent]),
    } as any;

    mockContext = {
      req: {
        param: vi.fn((key: string) => (key === 'agentId' ? 'test-agent' : undefined)),
        json: vi.fn().mockResolvedValue({
          messages: [{ role: 'user', content: 'test message' }],
          runId: 'test-run-id',
          toolCallId: 'test-tool-call-id',
        }),
        raw: {
          signal: new AbortController().signal,
        } as any,
      } as any,
      get: vi.fn((key: string) => {
        if (key === 'mastra') return mockMastra;
        if (key === 'requestContext') return new RequestContext();
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
    originalApproveToolCallHandler = handlers.approveToolCallHandler;
    originalDeclineToolCallHandler = handlers.declineToolCallHandler;
    originalStreamNetworkHandler = handlers.streamNetworkHandler;
  });

  describe('streamGenerateHandler: Early error detection', () => {
    it('should return HTTP 429 status when rate limit error occurs before streaming', async () => {
      const rateLimitError = createAI_APICallError({
        message: 'This request would exceed the rate limit for your organization of 30,000 input tokens per minute.',
        statusCode: 429,
        url: 'https://api.anthropic.com/v1/messages',
        isRetryable: true,
      });

      (mockAgent.stream as any).mockRejectedValue(rateLimitError);

      await expectHTTPException(() => originalStreamGenerateHandler(mockContext as Context), 429, 'rate limit');
    });

    it('should return HTTP 500 status when generic provider error occurs before streaming', async () => {
      const apiError = createAI_APICallError({
        message: 'Anthropic API error: Internal server error',
        statusCode: 500,
        url: 'https://api.anthropic.com/v1/messages',
        isRetryable: true,
      });

      (mockAgent.stream as any).mockRejectedValue(apiError);

      await expectHTTPException(() => originalStreamGenerateHandler(mockContext as Context), 500);
    });

    it('should return HTTP 401 status when authentication error occurs', async () => {
      const authError = createAI_APICallError({
        message: 'Invalid API key provided',
        statusCode: 401,
        url: 'https://api.anthropic.com/v1/messages',
        isRetryable: false,
      });

      (mockAgent.stream as any).mockRejectedValue(authError);

      await expectHTTPException(() => originalStreamGenerateHandler(mockContext as Context), 401);
    });

    it('should not return 200 OK when an error occurs', async () => {
      const rateLimitError = createAI_APICallError({
        message: 'Rate limit exceeded',
        statusCode: 429,
        url: 'https://api.anthropic.com/v1/messages',
        isRetryable: true,
      });

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

  describe('streamGenerateHandler: Mid-Stream error handling', () => {
    it('should emit error chunk when rate limit error occurs during streaming', async () => {
      const rateLimitError = createAI_APICallError({
        message: 'This request would exceed the rate limit for your organization of 30,000 input tokens per minute.',
        statusCode: 429,
        url: 'https://api.anthropic.com/v1/messages',
        isRetryable: true,
      });

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

      const chunks = await readStreamChunks(response!);
      const errorData = findErrorChunk(chunks);

      expect(errorData).toBeDefined();
      expect(errorData.type).toBe('error');
      expect(errorData.payload.error).toBeDefined();

      const errorMessage =
        typeof errorData.payload.error === 'string'
          ? errorData.payload.error
          : errorData.payload.error.message || JSON.stringify(errorData.payload.error);

      expect(errorMessage).toContain('rate limit');
    });

    it('should emit error chunk with proper Mastra ChunkType structure', async () => {
      const providerError = createAI_APICallError({
        message: 'Provider temporarily unavailable',
        statusCode: 503,
        url: 'https://api.anthropic.com/v1/messages',
        responseBody: '{"error": "service unavailable"}',
        isRetryable: true,
      });

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

      const chunks = await readStreamChunks(response!);
      const errorData = findErrorChunk(chunks);

      expect(errorData).toBeDefined();

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
      const streamError = createAI_APICallError({
        message: 'Stream interrupted',
        statusCode: 500,
        url: 'https://api.anthropic.com/v1/messages',
        isRetryable: true,
      });

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

      const chunks = await readStreamChunks(response!);

      // Verify error chunk was emitted before closing
      const errorData = findErrorChunk(chunks);
      expect(errorData).toBeDefined();
    });
  });

  describe('approveToolCallHandler', () => {
    beforeEach(async () => {});
    it('should return HTTP 429 when rate limit error occurs before streaming', async () => {
      const rateLimitError = createAI_APICallError({
        message: 'Rate limit exceeded',
        statusCode: 429,
        isRetryable: true,
      });

      (mockAgent.approveToolCall as any).mockRejectedValue(rateLimitError);

      await expectHTTPException(() => originalApproveToolCallHandler(mockContext as Context), 429);
    });

    it('should emit error chunk when error occurs during streaming', async () => {
      const streamError = createAI_APICallError({
        message: 'Stream error',
        statusCode: 500,
        isRetryable: true,
      });

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { type: 'text-delta', payload: { text: 'Test' } } })
          .mockRejectedValueOnce(streamError),
        cancel: vi.fn(),
      };

      (mockAgent.approveToolCall as any).mockResolvedValue({
        fullStream: { getReader: vi.fn(() => mockReader) },
      });

      const response = await originalApproveToolCallHandler(mockContext as Context);
      const chunks = await readStreamChunks(response!);
      const errorData = findErrorChunk(chunks);

      expect(errorData).toBeDefined();
      expect(errorData.type).toBe('error');
    });
  });

  describe('declineToolCallHandler', () => {
    it('should return HTTP 500 when provider error occurs before streaming', async () => {
      const providerError = createAI_APICallError({
        message: 'Provider error',
        statusCode: 500,
        isRetryable: true,
      });

      (mockAgent.declineToolCall as any).mockRejectedValue(providerError);

      await expectHTTPException(() => originalDeclineToolCallHandler(mockContext as Context), 500);
    });

    it('should emit error chunk when error occurs during streaming', async () => {
      const streamError = createAI_APICallError({
        message: 'Stream interrupted',
        statusCode: 503,
        isRetryable: true,
      });

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { type: 'text-delta', payload: { text: 'Test' } } })
          .mockRejectedValueOnce(streamError),
        cancel: vi.fn(),
      };

      (mockAgent.declineToolCall as any).mockResolvedValue({
        fullStream: { getReader: vi.fn(() => mockReader) },
      });

      const response = await originalDeclineToolCallHandler(mockContext as Context);
      const chunks = await readStreamChunks(response!);
      const errorData = findErrorChunk(chunks);

      expect(errorData).toBeDefined();
      expect(errorData.type).toBe('error');
    });
  });

  describe('streamNetworkHandler', () => {
    beforeEach(() => {
      (mockAgent.getMemory as any).mockResolvedValue({ threadId: 'test-thread' });
    });

    it('should return HTTP 500 when provider error occurs before streaming', async () => {
      const providerError = createAI_APICallError({
        message: 'Provider error',
        statusCode: 500,
        isRetryable: true,
      });

      (mockAgent.network as any).mockRejectedValue(providerError);

      await expectHTTPException(() => originalStreamNetworkHandler(mockContext as Context), 500);
    });

    it('should emit error chunk when error occurs during streaming', async () => {
      const streamError = createAI_APICallError({
        message: 'Network stream error',
        statusCode: 500,
        isRetryable: true,
      });

      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({ done: false, value: { type: 'text-delta', payload: { text: 'Test' } } })
          .mockRejectedValueOnce(streamError),
        cancel: vi.fn(),
      };

      (mockAgent.network as any).mockResolvedValue(mockReader);

      const response = await originalStreamNetworkHandler(mockContext as Context);
      const chunks = await readStreamChunks(response!);
      const errorData = findErrorChunk(chunks);

      expect(errorData).toBeDefined();
      expect(errorData.type).toBe('error');
    });
  });
});
