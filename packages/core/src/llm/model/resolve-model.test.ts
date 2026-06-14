import { openai } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import { RequestContext } from '../../request-context';
import { AISDKV4LegacyLanguageModel } from './aisdk/v4/model';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { resolveModelConfig } from './resolve-model';
import { ModelRouterLanguageModel } from './router';
import {
  TanStackLanguageModel,
  TanStackSummarizeLanguageModel,
  isTanStackTextAdapter,
  isTanStackSummarizeAdapter,
  isTanStackImageAdapter,
  isTanStackAdapter,
} from './tanstack/bridge';

describe('resolveModelConfig', () => {
  it('should resolve a magic string to ModelRouterLanguageModel', async () => {
    const result = await resolveModelConfig('openai/gpt-4o');
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a config object to ModelRouterLanguageModel', async () => {
    const result = await resolveModelConfig({
      id: 'openai/gpt-4o',
      apiKey: 'test-key',
    });
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should return a LanguageModel instance as-is', async () => {
    const model = openai('gpt-4o');
    const result = await resolveModelConfig(model);
    expect(result).toBeInstanceOf(AISDKV5LanguageModel);
    expect(result.modelId).toBe('gpt-4o');
    expect(result.provider).toBe('openai.responses');
    expect(result.specificationVersion).toBe('v2');
  });

  it('should resolve a dynamic function returning a string', async () => {
    const dynamicFn = () => 'openai/gpt-4o';
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a dynamic function returning a config object', async () => {
    const dynamicFn = () =>
      ({
        id: 'openai/gpt-4o',
        apiKey: 'test-key',
      }) as const;
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
  });

  it('should resolve a dynamic function returning a LanguageModel', async () => {
    const model = openai('gpt-4o');
    const dynamicFn = () => model;
    const result = await resolveModelConfig(dynamicFn);
    expect(result).toBeInstanceOf(AISDKV5LanguageModel);
    expect(result.modelId).toBe('gpt-4o');
    expect(result.provider).toBe('openai.responses');
    expect(result.specificationVersion).toBe('v2');
  });

  it('should pass requestContext to dynamic function', async () => {
    const requestContext = new RequestContext();
    requestContext.set('preferredModel', 'anthropic/claude-3-opus');

    const dynamicFn = ({ requestContext: ctx }) => {
      return ctx.get('preferredModel');
    };

    const result = await resolveModelConfig(dynamicFn, requestContext);
    expect(result).toBeInstanceOf(ModelRouterLanguageModel);
    expect(result.modelId).toBe(`claude-3-opus`);
    expect(result.provider).toBe(`anthropic`);
  });

  it('should throw error for invalid config', async () => {
    await expect(resolveModelConfig({} as any)).rejects.toThrow('Invalid model configuration');
  });

  describe('unknown specificationVersion handling', () => {
    it('should wrap a model with unknown specificationVersion as AISDKV5LanguageModel when it has doStream/doGenerate', async () => {
      const model = {
        specificationVersion: 'v4',
        provider: 'ollama.responses',
        modelId: 'llama3.2',
        supportedUrls: {},
        doGenerate: async () => ({}),
        doStream: async () => ({}),
      };
      const result = await resolveModelConfig(model as any);
      expect(result).toBeInstanceOf(AISDKV5LanguageModel);
      expect(result.specificationVersion).toBe('v2');
      expect(result.modelId).toBe('llama3.2');
      expect(result.provider).toBe('ollama.responses');
    });

    it('should pass through a model with unknown specificationVersion when it lacks doStream/doGenerate', async () => {
      const model = {
        specificationVersion: 'v4',
        provider: 'test',
        modelId: 'test-model',
      };
      const result = await resolveModelConfig(model as any);
      expect(result).not.toBeInstanceOf(AISDKV5LanguageModel);
      expect(result).toBe(model);
    });

    it('should wrap v1 models in AISDKV4LegacyLanguageModel (not AISDKV5LanguageModel)', async () => {
      const model = {
        specificationVersion: 'v1',
        provider: 'test',
        modelId: 'test-model',
        doGenerate: async () => ({}),
        doStream: async () => ({}),
      };
      const result = await resolveModelConfig(model as any);
      expect(result).toBeInstanceOf(AISDKV4LegacyLanguageModel);
      expect(result).not.toBeInstanceOf(AISDKV5LanguageModel);
      // Identity fields preserved
      expect(result.specificationVersion).toBe('v1');
      expect(result.provider).toBe('test');
      expect(result.modelId).toBe('test-model');
    });
  });

  describe('custom OpenAI-compatible config objects', () => {
    describe('using id format (provider/model)', () => {
      it('should resolve a custom config with id, url, and apiKey', async () => {
        const result = await resolveModelConfig({
          id: 'custom-provider/my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config with custom headers', async () => {
        const result = await resolveModelConfig({
          id: 'custom-provider/my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
          headers: {
            'x-custom-header': 'custom-value',
            'x-api-version': '2024-01',
          },
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config without apiKey (for public endpoints)', async () => {
        const result = await resolveModelConfig({
          id: 'public-provider/public-model',
          url: 'https://public-api.example.com/v1/chat/completions',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('public-model');
        expect(result.provider).toBe('public-provider');
      });
    });

    describe('using providerId/modelId format', () => {
      it('should resolve a custom config with providerId, modelId, url, and apiKey', async () => {
        const result = await resolveModelConfig({
          providerId: 'custom-provider',
          modelId: 'my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config with custom headers', async () => {
        const result = await resolveModelConfig({
          providerId: 'custom-provider',
          modelId: 'my-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'custom-api-key',
          headers: {
            'x-custom-header': 'custom-value',
            'x-api-version': '2024-01',
          },
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('my-model');
        expect(result.provider).toBe('custom-provider');
      });

      it('should resolve a custom config without apiKey (for public endpoints)', async () => {
        const result = await resolveModelConfig({
          providerId: 'public-provider',
          modelId: 'public-model',
          url: 'https://public-api.example.com/v1/chat/completions',
        });
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('public-model');
        expect(result.provider).toBe('public-provider');
      });
    });

    describe('dynamic functions', () => {
      it('should resolve a dynamic function returning id format', async () => {
        const dynamicFn = () =>
          ({
            id: 'dynamic-provider/dynamic-model',
            url: 'https://api.mycompany.com/v1/chat/completions',
            apiKey: 'dynamic-api-key',
          }) as const;
        const result = await resolveModelConfig(dynamicFn);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('dynamic-model');
        expect(result.provider).toBe('dynamic-provider');
      });

      it('should resolve a dynamic function returning providerId/modelId format', async () => {
        const dynamicFn = () => ({
          providerId: 'dynamic-provider',
          modelId: 'dynamic-model',
          url: 'https://api.mycompany.com/v1/chat/completions',
          apiKey: 'dynamic-api-key',
        });
        const result = await resolveModelConfig(dynamicFn);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('dynamic-model');
        expect(result.provider).toBe('dynamic-provider');
      });

      it('should resolve a custom config selected from request context', async () => {
        const requestContext = new RequestContext();
        requestContext.set('customEndpoint', 'https://api.mycompany.com/v1/chat/completions');
        requestContext.set('customApiKey', 'context-api-key');

        const dynamicFn = ({ requestContext: ctx }) => ({
          providerId: 'context-provider',
          modelId: 'context-model',
          url: ctx.get('customEndpoint'),
          apiKey: ctx.get('customApiKey'),
        });

        const result = await resolveModelConfig(dynamicFn, requestContext);
        expect(result).toBeInstanceOf(ModelRouterLanguageModel);
        expect(result.modelId).toBe('context-model');
        expect(result.provider).toBe('context-provider');
      });
    });
  });

  describe('TanStack AI TextAdapter support', () => {
    function createFakeTanStackAdapter(name: string, model: string, events?: Array<Record<string, unknown>>) {
      return {
        kind: 'text' as const,
        name,
        model,
        chatStream: async function* () {
          if (events) {
            for (const e of events) yield e;
          }
        },
        structuredOutput: async () => ({ data: {}, rawText: '' }),
      };
    }

    it('should resolve a TanStack AI TextAdapter to TanStackLanguageModel', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o');
      const result = await resolveModelConfig(adapter as any);
      expect(result).toBeInstanceOf(TanStackLanguageModel);
      expect(result.modelId).toBe('gpt-4o');
      expect(result.provider).toBe('openai');
      expect(result.specificationVersion).toBe('v2');
    });

    it('should resolve a TanStack Anthropic adapter', async () => {
      const adapter = createFakeTanStackAdapter('anthropic', 'claude-sonnet-4-20250514');
      const result = await resolveModelConfig(adapter as any);
      expect(result).toBeInstanceOf(TanStackLanguageModel);
      expect(result.modelId).toBe('claude-sonnet-4-20250514');
      expect(result.provider).toBe('anthropic');
    });

    it('should resolve a dynamic function returning a TanStack adapter', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o');
      const dynamicFn = () => adapter;
      const result = await resolveModelConfig(dynamicFn as any);
      expect(result).toBeInstanceOf(TanStackLanguageModel);
      expect(result.modelId).toBe('gpt-4o');
      expect(result.provider).toBe('openai');
    });

    it('should stream text through the bridge', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'Hello' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: ' world' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts[0]).toEqual({ type: 'stream-start', warnings: [] });
      expect(parts.find(p => p.type === 'text-start')).toBeDefined();
      const textDeltas = parts.filter(p => p.type === 'text-delta');
      expect(textDeltas).toHaveLength(2);
      expect(textDeltas[0]!.delta).toBe('Hello');
      expect(textDeltas[1]!.delta).toBe(' world');
      expect(parts.find(p => p.type === 'text-end')).toBeDefined();
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(finish!.finishReason).toBe('stop');
      expect((finish as any).usage.inputTokens).toBe(10);
      expect((finish as any).usage.outputTokens).toBe(5);
    });

    it('should translate tool calls through the bridge', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'get_weather' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"city":"SF"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
        {
          type: 'RUN_FINISHED',
          finishReason: 'tool_calls',
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'weather in SF?' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts.find(p => p.type === 'tool-input-start')).toMatchObject({
        type: 'tool-input-start',
        id: 'tc-1',
        toolName: 'get_weather',
      });
      expect(parts.find(p => p.type === 'tool-input-delta')).toMatchObject({
        type: 'tool-input-delta',
        id: 'tc-1',
        delta: '{"city":"SF"}',
      });
      const toolCall = parts.find(p => p.type === 'tool-call');
      expect(toolCall).toMatchObject({
        type: 'tool-call',
        toolCallId: 'tc-1',
        toolName: 'get_weather',
        input: '{"city":"SF"}',
      });
      const finish = parts.find(p => p.type === 'finish');
      expect(finish!.finishReason).toBe('tool-calls');
    });

    it('should translate errors through the bridge', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'RUN_ERROR', message: 'Rate limit exceeded' },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const errorPart = parts.find(p => p.type === 'error');
      expect(errorPart).toBeDefined();
      expect((errorPart!.error as Error).message).toBe('Rate limit exceeded');
    });

    it('should pass system messages and tools to the adapter', async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const adapter = {
        kind: 'text' as const,
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* (opts: Record<string, unknown>) {
          capturedOptions = opts;
          yield { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' };
          yield { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' };
          yield { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'ok' };
          yield { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' };
          yield { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} };
        },
      };

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [
          { role: 'system', content: 'You are a weather bot' },
          { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
        ],
        tools: [
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get weather for a city',
            inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
          },
        ],
      } as any);

      // Consume the stream
      const reader = stream.getReader();
      while (!(await reader.read()).done) {}

      expect(capturedOptions).toBeDefined();
      expect((capturedOptions as any).systemPrompts).toEqual(['You are a weather bot']);
      expect((capturedOptions as any).messages).toHaveLength(1);
      expect((capturedOptions as any).messages[0].role).toBe('user');
      expect((capturedOptions as any).tools).toHaveLength(1);
      expect((capturedOptions as any).tools[0].name).toBe('get_weather');
    });

    it('should translate reasoning/thinking events through the bridge', async () => {
      const adapter = createFakeTanStackAdapter('anthropic', 'claude-sonnet-4-20250514', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'REASONING_START' },
        { type: 'REASONING_MESSAGE_CONTENT', delta: 'Let me think...' },
        { type: 'REASONING_MESSAGE_CONTENT', delta: ' about this.' },
        { type: 'REASONING_END' },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'The answer is 42.' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: { inputTokens: 30, outputTokens: 20 } },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'What is 6*7?' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts.find(p => p.type === 'reasoning-start')).toBeDefined();
      const reasoningDeltas = parts.filter(p => p.type === 'reasoning-delta');
      expect(reasoningDeltas).toHaveLength(2);
      expect(reasoningDeltas[0]!.delta).toBe('Let me think...');
      expect(reasoningDeltas[1]!.delta).toBe(' about this.');
      expect(parts.find(p => p.type === 'reasoning-end')).toBeDefined();

      const textDeltas = parts.filter(p => p.type === 'text-delta');
      expect(textDeltas).toHaveLength(1);
      expect(textDeltas[0]!.delta).toBe('The answer is 42.');
    });

    it('should handle multiple tool calls in a single stream', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'get_weather' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"city":"SF"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
        { type: 'TOOL_CALL_START', toolCallId: 'tc-2', toolCallName: 'get_time' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-2', delta: '{"timezone":"PST"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-2' },
        { type: 'RUN_FINISHED', finishReason: 'tool_calls', usage: { inputTokens: 10, outputTokens: 8 } },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'weather and time?' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const toolCalls = parts.filter(p => p.type === 'tool-call');
      expect(toolCalls).toHaveLength(2);
      expect(toolCalls[0]).toMatchObject({ toolCallId: 'tc-1', toolName: 'get_weather', input: '{"city":"SF"}' });
      expect(toolCalls[1]).toMatchObject({
        toolCallId: 'tc-2',
        toolName: 'get_time',
        input: '{"timezone":"PST"}',
      });
    });

    it('should handle tool args arriving in multiple deltas', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'search' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"q' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: 'uery":"' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: 'hello"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
        { type: 'RUN_FINISHED', finishReason: 'tool_calls', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'search' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const toolCall = parts.find(p => p.type === 'tool-call');
      expect(toolCall).toMatchObject({ input: '{"query":"hello"}' });
    });

    it('should handle empty stream (no events)', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', []);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      // Should at least have stream-start
      expect(parts[0]).toEqual({ type: 'stream-start', warnings: [] });
      expect(parts).toHaveLength(1);
    });

    it('should handle content_filter finish reason', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'RUN_FINISHED', finishReason: 'content_filter', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'blocked' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const finish = parts.find(p => p.type === 'finish');
      expect(finish!.finishReason).toBe('content-filter');
    });

    it('should map length finish reason', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED' },
        { type: 'RUN_FINISHED', finishReason: 'length', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'long' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts.find(p => p.type === 'finish')!.finishReason).toBe('length');
    });

    it('should handle unknown finish reasons', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED' },
        { type: 'RUN_FINISHED', finishReason: 'some_new_reason', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts.find(p => p.type === 'finish')!.finishReason).toBe('unknown');
    });

    it('should emit response-metadata when RUN_STARTED has a model field', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1', model: 'gpt-4o-2025-06-01' },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'Hi' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const metadata = parts.find(p => p.type === 'response-metadata');
      expect(metadata).toBeDefined();
      expect(metadata!.modelId).toBe('gpt-4o-2025-06-01');
    });

    it('should handle adapter throwing an error', async () => {
      const adapter = {
        kind: 'text' as const,
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* () {
          yield { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' };
          throw new Error('Connection reset');
        },
      };

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const errorPart = parts.find(p => p.type === 'error');
      expect(errorPart).toBeDefined();
      expect((errorPart!.error as Error).message).toBe('Connection reset');
    });

    it('should handle usage with promptTokens/completionTokens (alternative naming)', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED' },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'ok' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: { promptTokens: 15, completionTokens: 7 } },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const finish = parts.find(p => p.type === 'finish');
      expect((finish as any).usage.inputTokens).toBe(15);
      expect((finish as any).usage.outputTokens).toBe(7);
    });

    it('should translate multi-role conversation prompt', async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const adapter = {
        kind: 'text' as const,
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* (opts: Record<string, unknown>) {
          capturedOptions = opts;
          yield { type: 'RUN_STARTED' };
          yield { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' };
          yield { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'ok' };
          yield { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' };
          yield { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} };
        },
      };

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hi there!' },
              {
                type: 'tool-call',
                toolCallId: 'tc-prev',
                toolName: 'lookup',
                input: '{"q":"test"}',
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'tc-prev',
                toolName: 'lookup',
                output: { type: 'text', value: 'result data' },
              },
            ],
          },
          { role: 'user', content: [{ type: 'text', text: 'Thanks' }] },
        ],
      } as any);

      const reader = stream.getReader();
      while (!(await reader.read()).done) {}

      expect(capturedOptions).toBeDefined();
      const msgs = (capturedOptions as any).messages;
      expect(msgs).toHaveLength(4); // user, assistant, tool, user
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('Hello');
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].content).toBe('Hi there!');
      expect(msgs[1].toolCalls).toHaveLength(1);
      expect(msgs[1].toolCalls[0].id).toBe('tc-prev');
      expect(msgs[2].role).toBe('tool');
      expect(msgs[2].toolCallId).toBe('tc-prev');
      expect(msgs[2].content).toBe('result data');
      expect(msgs[3].role).toBe('user');
      expect(msgs[3].content).toBe('Thanks');
      expect((capturedOptions as any).systemPrompts).toEqual(['You are helpful']);
    });

    it('should translate assistant messages with reasoning content', async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const adapter = {
        kind: 'text' as const,
        name: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        chatStream: async function* (opts: Record<string, unknown>) {
          capturedOptions = opts;
          yield { type: 'RUN_STARTED' };
          yield { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} };
        },
      };

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'Think about this' }] },
          {
            role: 'assistant',
            content: [
              { type: 'reasoning', text: 'I need to consider...' },
              { type: 'text', text: 'After thinking, here is my answer.' },
            ],
          },
        ],
      } as any);

      const reader = stream.getReader();
      while (!(await reader.read()).done) {}

      const msgs = (capturedOptions as any).messages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1].role).toBe('assistant');
      expect(msgs[1].thinking).toHaveLength(1);
      expect(msgs[1].thinking[0].content).toBe('I need to consider...');
      expect(msgs[1].content).toBe('After thinking, here is my answer.');
    });

    it('should translate tool-result with json output type', async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const adapter = {
        kind: 'text' as const,
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* (opts: Record<string, unknown>) {
          capturedOptions = opts;
          yield { type: 'RUN_STARTED' };
          yield { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} };
        },
      };

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [
          { role: 'user', content: [{ type: 'text', text: 'call tool' }] },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'tc-json',
                toolName: 'fetch_data',
                output: { type: 'json', value: { temperature: 72, unit: 'F' } },
              },
            ],
          },
        ],
      } as any);

      const reader = stream.getReader();
      while (!(await reader.read()).done) {}

      const msgs = (capturedOptions as any).messages;
      const toolMsg = msgs.find((m: any) => m.role === 'tool');
      expect(toolMsg.content).toBe('{"temperature":72,"unit":"F"}');
    });

    it('should handle STEP_STARTED and STEP_FINISHED events (ignored gracefully)', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'STEP_STARTED', stepId: 's1' },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'step content' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'STEP_FINISHED', stepId: 's1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      // Should not produce any STEP events in output
      expect(parts.filter(p => (p.type as string).includes('step'))).toHaveLength(0);
      expect(parts.filter(p => p.type === 'text-delta')).toHaveLength(1);
    });

    it('should handle CUSTOM events (ignored gracefully)', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED' },
        { type: 'CUSTOM', name: 'my-event', data: { foo: 'bar' } },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'ok' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      // CUSTOM events should be silently skipped
      expect(parts.filter(p => p.type === 'text-delta')).toHaveLength(1);
    });

    it('should filter non-function tool types', async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const adapter = {
        kind: 'text' as const,
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* (opts: Record<string, unknown>) {
          capturedOptions = opts;
          yield { type: 'RUN_STARTED' };
          yield { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} };
        },
      };

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        tools: [
          { type: 'function', name: 'valid_tool', inputSchema: {} },
          { type: 'provider-defined', name: 'invalid_tool', id: 'x' } as any,
        ],
      } as any);

      const reader = stream.getReader();
      while (!(await reader.read()).done) {}

      expect((capturedOptions as any).tools).toHaveLength(1);
      expect((capturedOptions as any).tools[0].name).toBe('valid_tool');
    });

    it('doGenerate delegates to doStream', async () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o', [
        { type: 'RUN_STARTED' },
        { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'generated' },
        { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
        { type: 'RUN_FINISHED', finishReason: 'stop', usage: {} },
      ]);

      const model = new TanStackLanguageModel(adapter as any);
      const { stream } = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts.filter(p => p.type === 'text-delta')).toHaveLength(1);
    });

    it('serializeForSpan returns correct metadata', () => {
      const adapter = createFakeTanStackAdapter('openai', 'gpt-4o');
      const model = new TanStackLanguageModel(adapter as any);
      expect(model.serializeForSpan()).toEqual({
        specificationVersion: 'v2',
        modelId: 'gpt-4o',
        provider: 'openai',
      });
    });
  });

  describe('TanStack AI SummarizeAdapter support', () => {
    function createFakeSummarizeAdapter(
      name: string,
      model: string,
      options?: {
        streamEvents?: Array<Record<string, unknown>>;
        summarizeResult?: Record<string, unknown>;
      },
    ) {
      return {
        kind: 'summarize' as const,
        name,
        model,
        summarize: async () =>
          options?.summarizeResult || {
            id: 'sum-1',
            summary: 'default summary',
            usage: { promptTokens: 10, completionTokens: 5 },
          },
        ...(options?.streamEvents
          ? {
              summarizeStream: async function* () {
                for (const e of options.streamEvents!) yield e;
              },
            }
          : {}),
      };
    }

    it('should resolve a TanStack AI SummarizeAdapter to TanStackSummarizeLanguageModel', async () => {
      const adapter = createFakeSummarizeAdapter('openai', 'gpt-4o');
      const result = await resolveModelConfig(adapter as any);
      expect(result).toBeInstanceOf(TanStackSummarizeLanguageModel);
      expect(result.modelId).toBe('gpt-4o');
      expect(result.provider).toBe('openai');
      expect(result.specificationVersion).toBe('v2');
    });

    it('should stream through summarizeStream when available', async () => {
      const adapter = createFakeSummarizeAdapter('openai', 'gpt-4o', {
        streamEvents: [
          { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
          { type: 'TEXT_MESSAGE_START', messageId: 'msg-1' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'Summary: ' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg-1', delta: 'This is a test.' },
          { type: 'TEXT_MESSAGE_END', messageId: 'msg-1' },
          { type: 'RUN_FINISHED', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 20 } },
        ],
      });

      const model = new TanStackSummarizeLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Summarize this long text...' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      const textDeltas = parts.filter(p => p.type === 'text-delta');
      expect(textDeltas).toHaveLength(2);
      expect(textDeltas[0]!.delta).toBe('Summary: ');
      expect(textDeltas[1]!.delta).toBe('This is a test.');
    });

    it('should fall back to non-streaming summarize when summarizeStream is not available', async () => {
      const adapter = createFakeSummarizeAdapter('openai', 'gpt-4o', {
        summarizeResult: {
          id: 'sum-1',
          summary: 'A concise summary of the input text.',
          usage: { promptTokens: 100, completionTokens: 20 },
        },
      });

      const model = new TanStackSummarizeLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Long text to summarize...' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts[0]).toEqual({ type: 'stream-start', warnings: [] });
      expect(parts.find(p => p.type === 'text-start')).toBeDefined();
      const textDelta = parts.find(p => p.type === 'text-delta');
      expect(textDelta!.delta).toBe('A concise summary of the input text.');
      expect(parts.find(p => p.type === 'text-end')).toBeDefined();
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(finish!.finishReason).toBe('stop');
      expect((finish as any).usage.inputTokens).toBe(100);
      expect((finish as any).usage.outputTokens).toBe(20);
    });

    it('should pass user text to summarize as concatenated user messages', async () => {
      let capturedOptions: Record<string, unknown> | undefined;
      const adapter = {
        kind: 'summarize' as const,
        name: 'openai',
        model: 'gpt-4o',
        summarize: async (opts: Record<string, unknown>) => {
          capturedOptions = opts;
          return { id: 'sum-1', summary: 'summarized' };
        },
      };

      const model = new TanStackSummarizeLanguageModel(adapter as any);
      const { stream } = await model.doStream({
        prompt: [
          { role: 'system', content: 'Summarize concisely' },
          { role: 'user', content: [{ type: 'text', text: 'First paragraph.' }] },
          { role: 'user', content: [{ type: 'text', text: 'Second paragraph.' }] },
        ],
      } as any);

      const reader = stream.getReader();
      while (!(await reader.read()).done) {}

      expect(capturedOptions).toBeDefined();
      expect((capturedOptions as any).text).toBe('First paragraph.\nSecond paragraph.');
      expect((capturedOptions as any).systemPrompt).toBe('Summarize concisely');
    });

    it('should resolve a dynamic function returning a SummarizeAdapter', async () => {
      const adapter = createFakeSummarizeAdapter('anthropic', 'claude-sonnet-4-20250514');
      const dynamicFn = () => adapter;
      const result = await resolveModelConfig(dynamicFn as any);
      expect(result).toBeInstanceOf(TanStackSummarizeLanguageModel);
      expect(result.modelId).toBe('claude-sonnet-4-20250514');
    });

    it('doGenerate delegates to doStream for summarize', async () => {
      const adapter = createFakeSummarizeAdapter('openai', 'gpt-4o');
      const model = new TanStackSummarizeLanguageModel(adapter as any);
      const { stream } = await model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'summarize' }] }],
      } as any);

      const parts: Array<Record<string, unknown>> = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as Record<string, unknown>);
      }

      expect(parts.find(p => p.type === 'text-delta')).toBeDefined();
    });

    it('serializeForSpan returns correct metadata for summarize', () => {
      const adapter = createFakeSummarizeAdapter('openai', 'gpt-4o');
      const model = new TanStackSummarizeLanguageModel(adapter as any);
      expect(model.serializeForSpan()).toEqual({
        specificationVersion: 'v2',
        modelId: 'gpt-4o',
        provider: 'openai',
      });
    });
  });

  describe('TanStack AI ImageAdapter detection', () => {
    it('should throw a descriptive error when passing an ImageAdapter as model', async () => {
      const adapter = {
        kind: 'image' as const,
        name: 'openai',
        model: 'dall-e-3',
        generateImages: async () => ({ images: [] }),
      };

      await expect(resolveModelConfig(adapter as any)).rejects.toThrow(
        /ImageAdapter.*cannot be used as a language model/,
      );
      await expect(resolveModelConfig(adapter as any)).rejects.toThrow(/openai\/dall-e-3/);
    });
  });

  describe('isTanStackTextAdapter', () => {
    it('should detect a valid TanStack adapter shape', () => {
      const adapter = {
        kind: 'text',
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* () {},
      };
      expect(isTanStackTextAdapter(adapter)).toBe(true);
    });

    it('should reject null and primitives', () => {
      expect(isTanStackTextAdapter(null)).toBe(false);
      expect(isTanStackTextAdapter(undefined)).toBe(false);
      expect(isTanStackTextAdapter('openai/gpt-4o')).toBe(false);
      expect(isTanStackTextAdapter(42)).toBe(false);
    });

    it('should reject objects without kind=text', () => {
      expect(isTanStackTextAdapter({ kind: 'image', name: 'openai', model: 'dall-e-3', chatStream: () => {} })).toBe(
        false,
      );
    });

    it('should reject objects missing chatStream', () => {
      expect(isTanStackTextAdapter({ kind: 'text', name: 'openai', model: 'gpt-4o' })).toBe(false);
    });

    it('should reject AI SDK LanguageModel objects (which have specificationVersion)', () => {
      const aiSdkModel = {
        kind: 'text',
        name: 'openai',
        model: 'gpt-4o',
        chatStream: () => {},
        specificationVersion: 'v2',
      };
      expect(isTanStackTextAdapter(aiSdkModel)).toBe(false);
    });

    it('should reject a summarize adapter', () => {
      const adapter = {
        kind: 'summarize',
        name: 'openai',
        model: 'gpt-4o',
        summarize: async () => ({}),
      };
      expect(isTanStackTextAdapter(adapter)).toBe(false);
    });
  });

  describe('isTanStackSummarizeAdapter', () => {
    it('should detect a valid SummarizeAdapter shape', () => {
      const adapter = {
        kind: 'summarize',
        name: 'openai',
        model: 'gpt-4o',
        summarize: async () => ({}),
      };
      expect(isTanStackSummarizeAdapter(adapter)).toBe(true);
    });

    it('should detect SummarizeAdapter with summarizeStream', () => {
      const adapter = {
        kind: 'summarize',
        name: 'openai',
        model: 'gpt-4o',
        summarize: async () => ({}),
        summarizeStream: async function* () {},
      };
      expect(isTanStackSummarizeAdapter(adapter)).toBe(true);
    });

    it('should reject text adapters', () => {
      const adapter = {
        kind: 'text',
        name: 'openai',
        model: 'gpt-4o',
        chatStream: async function* () {},
      };
      expect(isTanStackSummarizeAdapter(adapter)).toBe(false);
    });

    it('should reject objects without summarize function', () => {
      expect(
        isTanStackSummarizeAdapter({
          kind: 'summarize',
          name: 'openai',
          model: 'gpt-4o',
        }),
      ).toBe(false);
    });

    it('should reject null and primitives', () => {
      expect(isTanStackSummarizeAdapter(null)).toBe(false);
      expect(isTanStackSummarizeAdapter(undefined)).toBe(false);
      expect(isTanStackSummarizeAdapter(42)).toBe(false);
    });

    it('should reject AI SDK LanguageModel objects with specificationVersion', () => {
      expect(
        isTanStackSummarizeAdapter({
          kind: 'summarize',
          name: 'openai',
          model: 'gpt-4o',
          summarize: async () => ({}),
          specificationVersion: 'v2',
        }),
      ).toBe(false);
    });
  });

  describe('isTanStackImageAdapter', () => {
    it('should detect a valid ImageAdapter shape', () => {
      const adapter = {
        kind: 'image',
        name: 'openai',
        model: 'dall-e-3',
        generateImages: async () => ({ images: [] }),
      };
      expect(isTanStackImageAdapter(adapter)).toBe(true);
    });

    it('should reject text adapters', () => {
      expect(
        isTanStackImageAdapter({
          kind: 'text',
          name: 'openai',
          model: 'gpt-4o',
          chatStream: async function* () {},
        }),
      ).toBe(false);
    });

    it('should reject objects without generateImages', () => {
      expect(isTanStackImageAdapter({ kind: 'image', name: 'openai', model: 'dall-e-3' })).toBe(false);
    });

    it('should reject AI SDK LanguageModel objects', () => {
      expect(
        isTanStackImageAdapter({
          kind: 'image',
          name: 'openai',
          model: 'dall-e-3',
          generateImages: async () => ({}),
          specificationVersion: 'v2',
        }),
      ).toBe(false);
    });
  });

  describe('isTanStackAdapter (general)', () => {
    it('should detect text adapters', () => {
      expect(
        isTanStackAdapter({ kind: 'text', name: 'openai', model: 'gpt-4o', chatStream: async function* () {} }),
      ).toBe(true);
    });

    it('should detect summarize adapters', () => {
      expect(
        isTanStackAdapter({ kind: 'summarize', name: 'openai', model: 'gpt-4o', summarize: async () => ({}) }),
      ).toBe(true);
    });

    it('should detect image adapters', () => {
      expect(
        isTanStackAdapter({
          kind: 'image',
          name: 'openai',
          model: 'dall-e-3',
          generateImages: async () => ({}),
        }),
      ).toBe(true);
    });

    it('should reject non-adapter objects', () => {
      expect(isTanStackAdapter({ kind: 'unknown', name: 'x', model: 'y' })).toBe(false);
      expect(isTanStackAdapter(null)).toBe(false);
      expect(isTanStackAdapter('openai/gpt-4o')).toBe(false);
    });
  });
});
