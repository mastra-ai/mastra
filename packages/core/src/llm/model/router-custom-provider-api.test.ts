import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockModel } from '../../test-utils/llm-mock.js';
import { ModelRouterLanguageModel } from './router.js';

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

const chatModel = vi.fn((_modelId: string) => createMockModel({ mockText: 'chat' }));
const responses = vi.fn((_modelId: string) => createMockModel({ mockText: 'responses' }));

async function drainStream(model: ModelRouterLanguageModel) {
  const { stream } = await model.doStream({
    prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  } as any);
  const reader = stream.getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
}

describe('ModelRouter - custom URL api selection', () => {
  beforeEach(() => {
    vi.mocked(createOpenAICompatible).mockReturnValue({ chatModel } as any);
    vi.mocked(createOpenAI).mockReturnValue({ responses } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to Chat Completions when api is omitted', async () => {
    const model = new ModelRouterLanguageModel({
      providerId: 'my-provider',
      modelId: 'my-model',
      url: 'http://localhost:9999/v1',
      apiKey: 'test-key',
    });

    await drainStream(model);

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'my-provider',
      apiKey: 'test-key',
      baseURL: 'http://localhost:9999/v1',
      headers: undefined,
      supportsStructuredOutputs: true,
    });
    expect(chatModel).toHaveBeenCalledWith('my-model');
    expect(createOpenAI).not.toHaveBeenCalled();
  });

  it("selects the Responses API when api: 'responses' (providerId/modelId shape)", async () => {
    const model = new ModelRouterLanguageModel({
      providerId: 'my-provider',
      modelId: 'my-model',
      url: 'http://localhost:9999/v1',
      apiKey: 'test-key',
      api: 'responses',
    });

    await drainStream(model);

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'http://localhost:9999/v1',
      headers: undefined,
    });
    expect(responses).toHaveBeenCalledWith('my-model');
    expect(createOpenAICompatible).not.toHaveBeenCalled();
  });

  it("selects the Responses API when api: 'responses' (id shape)", async () => {
    const model = new ModelRouterLanguageModel({
      id: 'my-provider/my-model',
      url: 'http://localhost:9999/v1',
      apiKey: 'test-key',
      api: 'responses',
    });

    await drainStream(model);

    expect(responses).toHaveBeenCalledWith('my-model');
    expect(createOpenAICompatible).not.toHaveBeenCalled();
  });

  it('keys chat and responses instances separately in the model cache', () => {
    const base = {
      gatewayId: 'my-provider',
      modelId: 'my-model',
      providerId: 'my-provider',
      url: 'http://localhost:9999/v1',
      apiKey: 'test-key',
      headersKey: '',
      resolvedTransport: 'fetch' as const,
      websocketKey: '',
      authScopeKey: 'explicit',
    };

    const chatKey = ModelRouterLanguageModel.computeModelCacheKey({ ...base, api: 'chat' });
    const responsesKey = ModelRouterLanguageModel.computeModelCacheKey({ ...base, api: 'responses' });

    // The api discriminator must be part of the cache key so that chat and
    // responses instances for the same URL/model cannot collide.
    expect(chatKey).not.toEqual(responsesKey);
  });
});
