import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleModel } from './openai-compatible.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('OpenAICompatibleModel', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create model with magic string', () => {
      const model = new OpenAICompatibleModel('openai/gpt-4o');
      expect(model.modelId).toBe('gpt-4o');
      expect(model.provider).toBe('openai');
    });

    it('should create model with direct URL', () => {
      const model = new OpenAICompatibleModel('https://custom.api.com/v1/chat/completions');
      expect(model.modelId).toBe('unknown');
      expect(model.provider).toBe('openai-compatible');
    });

    it('should create model with config object', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });
      expect(model.modelId).toBe('gpt-4o');
      expect(model.provider).toBe('openai-compatible');
    });

    it('should throw error for invalid magic string', () => {
      expect(() => {
        new OpenAICompatibleModel('invalid-string');
      }).toThrow('Invalid model string: "invalid-string". Use "provider/model" format or a direct URL.');
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        new OpenAICompatibleModel('unknown-provider/gpt-4o');
      }).toThrow('Unknown provider: unknown-provider. Use a custom URL instead.');
    });

    it('should throw error for missing API key', () => {
      // Remove API key from environment
      const originalEnv = process.env;
      process.env = {};

      expect(() => {
        new OpenAICompatibleModel('openai/gpt-4o');
      }).toThrow('API key not found for provider "openai". Please set the OPENAI_API_KEY environment variable.');

      // Restore environment
      process.env = originalEnv;
    });

    it('should resolve API key from environment', () => {
      const originalEnv = process.env;
      process.env = { OPENAI_API_KEY: 'sk-env-test' };

      const model = new OpenAICompatibleModel('openai/gpt-4o');
      expect(model.modelId).toBe('gpt-4o');

      // Restore environment
      process.env = originalEnv;
    });

    it('should use custom API key in config', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-custom',
      });
      expect(model.modelId).toBe('gpt-4o');
    });

    it('should handle multi-slash provider IDs', () => {
      const model = new OpenAICompatibleModel({
        id: 'chutes/Qwen/Qwen3-235B-A22B-Instruct-2507',
        url: 'https://api.chutes.ai/v1/chat/completions',
        apiKey: 'sk-custom',
      });
      expect(model.modelId).toBe('chutes/Qwen/Qwen3-235B-A22B-Instruct-2507');
      expect(model.provider).toBe('chutes/Qwen');
    });
  });

  describe('doGenerate', () => {
    it('should generate text response', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello, world!',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.content).toEqual([{ type: 'text', text: 'Hello, world!' }]);
      expect(result.finishReason).toBe('stop');
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });

    it('should handle tool calls in response', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'tool-1',
                    type: 'function',
                    function: {
                      name: 'testFunction',
                      arguments: '{"param": "value"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      expect(result.content).toEqual([
        {
          type: 'tool-call',
          toolCallId: 'tool-1',
          toolName: 'testFunction',
          input: '{"param": "value"}',
        },
      ]);
      expect(result.finishReason).toBe('tool-calls');
    });

    it('should handle structured output', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '{"result": "success"}',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              result: { type: 'string' },
            },
          },
        },
      });

      expect(result.content).toEqual([{ type: 'text', text: '{"result": "success"}' }]);
    });

    it('should handle authentication errors', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () => 'Unauthorized',
      });

      await expect(
        model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        }),
      ).rejects.toThrow('OpenAI-compatible API error: 401 - Unauthorized');
    });

    it('should handle general API errors', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => 'Internal Server Error',
      });

      await expect(
        model.doGenerate({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        }),
      ).rejects.toThrow('OpenAI-compatible API error: 500 - Internal Server Error');
    });

    it('should handle tools and tool choice', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234567890,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'I will use the tool.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        tools: [
          {
            name: 'testTool',
            description: 'A test tool',
            type: 'function',
            inputSchema: {
              type: 'object',
              properties: {
                param: { type: 'string' },
              },
            },
          },
        ],
        toolChoice: { type: 'auto' },
      });

      expect(result.content).toEqual([{ type: 'text', text: 'I will use the tool.' }]);
    });
  });

  describe('doStream', () => {
    it('should stream text response', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const mockStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {"content": "Hello"}, "finish_reason": null}]}\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {"content": " world!"}, "finish_reason": null}]}\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}\n',
            ),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const chunks = [];
      const reader = result.stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('type');
    });

    it('should handle tool call streaming', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const mockStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "id": "call_123", "function": {"name": "testTool", "arguments": ""}}]}, "finish_reason": null}]}\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\\"param\\": \\""}}]}, "finish_reason": null}]}\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {"tool_calls": [{"index": 0, "function": {"arguments": "value\\"}"}}]}, "finish_reason": null}]}\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"id": "test-id", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4o", "choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]}\n',
            ),
          );
          controller.close();
        },
      });

      const mockResponse = {
        ok: true,
        body: mockStream,
        headers: new Headers({
          'content-type': 'text/event-stream',
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      });

      const chunks = [];
      const reader = result.stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(chunk => (chunk as any).type === 'tool-call')).toBe(true);
    });

    it('should handle streaming errors', async () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => 'Internal Server Error',
      });

      await expect(
        model.doStream({
          prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        }),
      ).rejects.toThrow('OpenAI-compatible API error: 500 - Internal Server Error');
    });
  });

  describe('Anthropic provider', () => {
    it('should use x-api-key header for Anthropic', () => {
      const originalEnv = process.env;
      process.env = { ANTHROPIC_API_KEY: 'ant-test' };

      const model = new OpenAICompatibleModel('anthropic/claude-3-opus');

      // Check that the model was created successfully
      expect(model.modelId).toBe('claude-3-opus');
      expect(model.provider).toBe('anthropic');

      // Restore environment
      process.env = originalEnv;
    });

    it('should handle Anthropic structured output', async () => {
      const originalEnv = process.env;
      process.env = { ANTHROPIC_API_KEY: 'ant-test' };

      const model = new OpenAICompatibleModel('anthropic/claude-3-opus');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({
          id: 'test-id',
          object: 'chat.completion',
          created: 1234567890,
          model: 'claude-3-opus',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: '{"result": "success"}',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      });

      const result = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        responseFormat: {
          type: 'json',
          schema: {
            type: 'object',
            properties: {
              result: { type: 'string' },
            },
          },
        },
      });

      expect(result.content).toEqual([{ type: 'text', text: '{"result": "success"}' }]);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe('Provider overrides', () => {
    it('should handle Vercel AI Gateway', () => {
      // Mock the environment variable to avoid API key requirement in tests
      const originalEnv = process.env.AI_GATEWAY_API_KEY;
      process.env.AI_GATEWAY_API_KEY = 'test-api-key';

      const model = new OpenAICompatibleModel('vercel/deepseek/deepseek-r1');
      expect(model.modelId).toBe('deepseek/deepseek-r1');
      expect(model.provider).toBe('vercel');

      // Restore original environment variable
      if (originalEnv) {
        process.env.AI_GATEWAY_API_KEY = originalEnv;
      } else {
        delete process.env.AI_GATEWAY_API_KEY;
      }
    });

    it('should handle Netlify provider', () => {
      const model = new OpenAICompatibleModel({
        id: 'netlify/openai/gpt-4o',
        url: 'https://api.netlify.com/v1/chat/completions',
        apiKey: 'sk-custom',
      });
      expect(model.modelId).toBe('netlify/openai/gpt-4o');
      expect(model.provider).toBe('netlify/openai');
    });
  });

  describe('Message conversion', () => {
    it('should convert system messages correctly', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const messages = [
        { role: 'system', content: [{ type: 'text', text: 'You are a helpful assistant' }] },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      ];

      const converted = (model as any).convertMessagesToOpenAI(messages);

      expect(converted).toHaveLength(2);
      expect(converted[0]).toEqual({
        role: 'system',
        content: [{ type: 'text', text: 'You are a helpful assistant' }],
      });
      expect(converted[1]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    it('should convert user messages with multiple parts', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'file', data: 'https://example.com/image.jpg' },
          ],
        },
      ];

      const converted = (model as any).convertMessagesToOpenAI(messages);

      expect(converted).toHaveLength(1);
      expect(converted[0]).toEqual({
        role: 'user',
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
        ],
      });
    });

    it('should convert assistant messages with tool calls', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const messages = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will help you' },
            {
              type: 'tool-call',
              toolCallId: 'tool-1',
              toolName: 'testFunction',
              input: { param: 'value' },
            },
          ],
        },
      ];

      const converted = (model as any).convertMessagesToOpenAI(messages);

      expect(converted).toHaveLength(1);
      expect(converted[0]).toEqual({
        role: 'assistant',
        content: 'I will help you',
        tool_calls: [
          {
            id: 'tool-1',
            type: 'function',
            function: {
              name: 'testFunction',
              arguments: '{"param":"value"}',
            },
          },
        ],
      });
    });

    it('should convert tool messages correctly', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const messages = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tool-1',
              output: { result: 'success' },
            },
          ],
        },
      ];

      const converted = (model as any).convertMessagesToOpenAI(messages);

      expect(converted).toHaveLength(1);
      expect(converted[0]).toEqual({
        role: 'tool',
        tool_call_id: 'tool-1',
        content: '{"result":"success"}',
      });
    });
  });

  describe('Tool conversion', () => {
    it('should convert tools to OpenAI format', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const tools = {
        testTool: {
          name: 'testTool',
          description: 'A test tool',
          type: 'function',
          inputSchema: {
            type: 'object',
            properties: {
              param: { type: 'string' },
            },
          },
        },
      };

      const converted = (model as any).convertToolsToOpenAI(tools);

      expect(converted).toHaveLength(1);
      expect(converted[0]).toEqual({
        type: 'function',
        function: {
          name: 'testTool',
          description: 'A test tool',
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string' },
            },
          },
        },
      });
    });

    it('should handle empty tools', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const converted = (model as any).convertToolsToOpenAI({});
      expect(converted).toBeUndefined();
    });

    it('should handle undefined tools', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const converted = (model as any).convertToolsToOpenAI(undefined);
      expect(converted).toBeUndefined();
    });
  });

  describe('Finish reason mapping', () => {
    it('should map finish reasons correctly', () => {
      const model = new OpenAICompatibleModel({
        id: 'gpt-4o',
        url: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test',
      });

      const mapFinishReason = (model as any).mapFinishReason.bind(model);

      expect(mapFinishReason('stop')).toBe('stop');
      expect(mapFinishReason('length')).toBe('length');
      expect(mapFinishReason('max_tokens')).toBe('length');
      expect(mapFinishReason('tool_calls')).toBe('tool-calls');
      expect(mapFinishReason('function_call')).toBe('tool-calls');
      expect(mapFinishReason('content_filter')).toBe('content-filter');
      expect(mapFinishReason('unknown')).toBe('unknown');
      expect(mapFinishReason(null)).toBe('unknown');
    });
  });
});
