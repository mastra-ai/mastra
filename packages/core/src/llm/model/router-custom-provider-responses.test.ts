import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../../agent/index.js';
import { createMockModel } from '../../test-utils/llm-mock.js';
import { ModelRouterLanguageModel } from './router.js';

// Mock both factories BEFORE importing them so the router picks up the mocks.
vi.mock('@ai-sdk/openai-compatible-v6', async () => {
  return {
    createOpenAICompatible: vi.fn(),
  };
});

vi.mock('@ai-sdk/openai-v6', async () => {
  return {
    createOpenAI: vi.fn(),
  };
});

const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible-v6');
const { createOpenAI } = await import('@ai-sdk/openai-v6');

const GATEWAY_URL = 'http://fake-gateway.local:9999/openai/v1';

function makeAgent(model: ConstructorParameters<typeof Agent>[0]['model']) {
  return new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a helpful assistant.',
    model,
  });
}

describe('ModelRouter - Custom URL `api` selection', () => {
  beforeEach(() => {
    vi.mocked(createOpenAICompatible).mockReturnValue({
      chatModel: vi.fn((_modelId: string) => createMockModel({ mockText: 'Hello from chat completions!' })),
    } as any);

    vi.mocked(createOpenAI).mockReturnValue({
      responses: vi.fn((_modelId: string) => createMockModel({ mockText: 'Hello from responses!' })),
      chat: vi.fn(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('default (no `api`)', () => {
    it('keeps using the OpenAI-compatible chat model', async () => {
      const agent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
      });

      const result = await agent.generate('test', { maxSteps: 1 });

      expect(result.text).toBe('Hello from chat completions!');
      expect(createOpenAICompatible).toHaveBeenCalledTimes(1);
      expect(createOpenAI).not.toHaveBeenCalled();
    });

    it('treats `api: "chat"` the same as the default', async () => {
      const agent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        api: 'chat',
      });

      await agent.generate('test', { maxSteps: 1 });

      expect(createOpenAICompatible).toHaveBeenCalledTimes(1);
      const compatible = vi.mocked(createOpenAICompatible).mock.results[0]!.value;
      expect(compatible.chatModel).toHaveBeenCalledWith('my-model');
      expect(createOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('`api: "responses"`', () => {
    it('builds an OpenAI Responses model against the custom URL (id form)', async () => {
      const agent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        api: 'responses',
      });

      const result = await agent.generate('test', { maxSteps: 1 });

      expect(result.text).toBe('Hello from responses!');
      expect(createOpenAI).toHaveBeenCalledTimes(1);
      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: GATEWAY_URL,
        headers: undefined,
      });
      const openai = vi.mocked(createOpenAI).mock.results[0]!.value;
      expect(openai.responses).toHaveBeenCalledWith('my-model');
      expect(openai.chat).not.toHaveBeenCalled();
      expect(createOpenAICompatible).not.toHaveBeenCalled();
    });

    it('builds an OpenAI Responses model against the custom URL (providerId/modelId form)', async () => {
      const agent = makeAgent({
        providerId: 'my-gateway',
        modelId: 'my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        api: 'responses',
      });

      await agent.generate('test', { maxSteps: 1 });

      expect(createOpenAI).toHaveBeenCalledTimes(1);
      const openai = vi.mocked(createOpenAI).mock.results[0]!.value;
      expect(openai.responses).toHaveBeenCalledWith('my-model');
      expect(createOpenAICompatible).not.toHaveBeenCalled();
    });

    it('forwards custom headers to the Responses provider', async () => {
      const agent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        headers: { 'x-tenant': 'acme' },
        api: 'responses',
      });

      await agent.generate('test', { maxSteps: 1 });

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: GATEWAY_URL,
        headers: { 'x-tenant': 'acme' },
      });
    });

    it('works when streaming', async () => {
      const agent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        api: 'responses',
      });

      const stream = await agent.stream('test', { maxSteps: 1 });
      let text = '';
      for await (const chunk of stream.textStream) {
        text += chunk;
      }

      expect(text).toBe('Hello from responses!');
      expect(createOpenAI).toHaveBeenCalledTimes(1);
      expect(createOpenAICompatible).not.toHaveBeenCalled();
    });

    it('reuses the cached Responses model across calls on the same router instance', async () => {
      const model = new ModelRouterLanguageModel({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        api: 'responses',
      });
      const prompt = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }] }];

      await model.doGenerate({ prompt } as any);
      await model.doGenerate({ prompt } as any);

      expect(createOpenAI).toHaveBeenCalledTimes(1);
      const openai = vi.mocked(createOpenAI).mock.results[0]!.value;
      expect(openai.responses).toHaveBeenCalledTimes(1);
    });

    it('does not share a cached instance between chat and responses for the same endpoint', async () => {
      const chatAgent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
      });
      const responsesAgent = makeAgent({
        id: 'my-gateway/my-model',
        url: GATEWAY_URL,
        apiKey: 'test-key',
        api: 'responses',
      });

      const chatResult = await chatAgent.generate('test', { maxSteps: 1 });
      const responsesResult = await responsesAgent.generate('test', { maxSteps: 1 });

      expect(chatResult.text).toBe('Hello from chat completions!');
      expect(responsesResult.text).toBe('Hello from responses!');
      expect(createOpenAICompatible).toHaveBeenCalledTimes(1);
      expect(createOpenAI).toHaveBeenCalledTimes(1);
    });
  });

  describe('`api` without a custom URL', () => {
    it('is ignored and routes through the gateway as before', async () => {
      const previous = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'test-openai-key';
      try {
        // Without `url` the registry path is used; the mocked `createOpenAI` still satisfies it.
        const agent = makeAgent({
          id: 'openai/gpt-4o',
          api: 'responses',
        });

        const result = await agent.generate('test', { maxSteps: 1 });

        expect(result.text).toBe('Hello from responses!');
        expect(createOpenAICompatible).not.toHaveBeenCalled();
      } finally {
        if (previous === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = previous;
      }
    });
  });
});
