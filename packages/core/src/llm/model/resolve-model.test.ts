import { openai } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import { RequestContext } from '../../request-context';
import { AISDKV4LegacyLanguageModel } from './aisdk/v4/model';
import { AISDKV5LanguageModel } from './aisdk/v5/model';
import { resolveModelConfig } from './resolve-model';
import { ModelRouterLanguageModel } from './router';
import { TanStackLanguageModel, isTanStackTextAdapter } from './tanstack/bridge';

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
    function createFakeTanStackAdapter(
      name: string,
      model: string,
      events?: Array<Record<string, unknown>>,
    ) {
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
  });
});
