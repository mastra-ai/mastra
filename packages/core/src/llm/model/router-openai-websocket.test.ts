import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../../agent/index.js';
import { createMockModel } from '../../test-utils/llm-mock.js';
import { MASTRA_GATEWAY_STREAM_TRANSPORT, MastraModelGateway } from './gateways/base.js';
import type { GatewayLanguageModel, ProviderConfig } from './gateways/base.js';
import { ModelRouterLanguageModel } from './router.js';

const { closeSpy, wsFetch } = vi.hoisted(() => {
  const closeSpy = vi.fn();
  const wsFetch = Object.assign(
    (..._args: any[]) => Promise.reject(new Error('Unexpected WebSocket fetch call in test')),
    { close: closeSpy },
  );

  return { closeSpy, wsFetch };
});

vi.mock('@ai-sdk/openai-v6', async () => {
  return {
    createOpenAI: vi.fn(),
  };
});

vi.mock('./openai-websocket-fetch.js', async () => {
  return {
    createOpenAIWebSocketFetch: vi.fn(() => wsFetch),
  };
});

const { createOpenAI } = await import('@ai-sdk/openai-v6');

describe('ModelRouter - OpenAI WebSocket transport', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    (ModelRouterLanguageModel as any)._clearCachesForTests();
    closeSpy.mockClear();

    vi.mocked(createOpenAI).mockImplementation(() => {
      return {
        responses: vi.fn((_modelId: string) => {
          return createMockModel({ mockText: 'Hello from OpenAI!' });
        }),
      } as any;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it('uses WebSocket fetch when transport is websocket and closes on finish by default', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: {
        id: 'openai/gpt-4o',
        headers: { 'X-Test': 'ws' },
      },
    });

    const stream = await agent.stream('Hello', {
      providerOptions: {
        openai: {
          transport: 'websocket',
          websocket: { url: 'wss://api.openai.com/v1/responses' },
        },
      },
    });

    for await (const _chunk of stream.textStream) {
      // drain the stream
    }

    const calls = vi.mocked(createOpenAI).mock.calls;
    const hasWebSocketFetch = calls.some(([args]) => typeof args.fetch === 'function');

    expect(hasWebSocketFetch).toBe(true);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close when closeOnFinish is false', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: {
        id: 'openai/gpt-4o',
        headers: { 'X-Test': 'ws' },
      },
    });

    const stream = await agent.stream('Hello', {
      providerOptions: {
        openai: {
          transport: 'websocket',
          websocket: { closeOnFinish: false },
        },
      },
    });

    for await (const _chunk of stream.textStream) {
      // drain the stream
    }

    expect(closeSpy).not.toHaveBeenCalled();

    stream.transport?.close();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('uses HTTP fetch by default', async () => {
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a helpful assistant.',
      model: {
        id: 'openai/gpt-4o',
        headers: { 'X-Test': 'fetch' },
      },
    });

    const stream = await agent.stream('Hello');

    for await (const _chunk of stream.textStream) {
      // drain the stream
    }

    const calls = vi.mocked(createOpenAI).mock.calls;
    const hasWebSocketFetch = calls.some(([args]) => typeof args.fetch === 'function');

    expect(hasWebSocketFetch).toBe(false);
  });

  it('passes Azure WebSocket transport options through prefixed gateways', async () => {
    const azureCloseSpy = vi.fn();
    const calls: Array<Record<string, unknown>> = [];
    class TestAzureGateway extends MastraModelGateway {
      readonly id = 'azure-openai';
      readonly name = 'azure-openai';

      fetchProviders(): Promise<Record<string, ProviderConfig>> {
        return Promise.resolve({
          'azure-openai': {
            name: 'Azure OpenAI',
            models: ['gpt-5-4-deployment'],
            apiKeyEnvVar: [],
            gateway: 'azure-openai',
          },
        });
      }

      buildUrl(): undefined {
        return undefined;
      }

      getApiKey(): Promise<string> {
        return Promise.resolve('test-azure-key');
      }

      resolveLanguageModel(args: Record<string, unknown>): GatewayLanguageModel {
        calls.push(args);
        const model = createMockModel({ mockText: 'Hello from Azure!' }) as GatewayLanguageModel;
        Object.defineProperty(model, MASTRA_GATEWAY_STREAM_TRANSPORT, {
          configurable: true,
          value: {
            type: 'openai-websocket',
            close: azureCloseSpy,
          },
        });
        return model;
      }
    }

    const router = new ModelRouterLanguageModel('azure-openai/gpt-5-4-deployment', [new TestAzureGateway()]);

    await router.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      providerOptions: {
        azure: {
          transport: 'websocket',
          websocket: { closeOnFinish: false },
        },
      },
    } as any);

    expect(calls[0]).toMatchObject({
      providerId: 'azure-openai',
      modelId: 'gpt-5-4-deployment',
      transport: 'websocket',
      openaiWebSocket: { closeOnFinish: false },
    });
    expect(router._getStreamTransport()).toMatchObject({
      type: 'openai-websocket',
      closeOnFinish: false,
    });
    router._getStreamTransport()?.close();
    expect(azureCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('scopes Azure WebSocket model cache entries by gateway instance', async () => {
    class TestAzureGateway extends MastraModelGateway {
      readonly id = 'azure-openai';
      readonly name = 'azure-openai';

      constructor(
        private close: () => void,
        private calls: Array<Record<string, unknown>>,
      ) {
        super();
      }

      fetchProviders(): Promise<Record<string, ProviderConfig>> {
        return Promise.resolve({
          'azure-openai': {
            name: 'Azure OpenAI',
            models: ['gpt-5-4-deployment'],
            apiKeyEnvVar: [],
            gateway: 'azure-openai',
          },
        });
      }

      buildUrl(): undefined {
        return undefined;
      }

      getApiKey(): Promise<string> {
        return Promise.resolve('test-azure-key');
      }

      resolveLanguageModel(args: Record<string, unknown>): GatewayLanguageModel {
        this.calls.push(args);
        const model = createMockModel({ mockText: 'Hello from Azure!' }) as GatewayLanguageModel;
        Object.defineProperty(model, MASTRA_GATEWAY_STREAM_TRANSPORT, {
          configurable: true,
          value: {
            type: 'openai-websocket',
            close: this.close,
          },
        });
        return model;
      }
    }

    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const firstCalls: Array<Record<string, unknown>> = [];
    const secondCalls: Array<Record<string, unknown>> = [];
    const firstRouter = new ModelRouterLanguageModel('azure-openai/gpt-5-4-deployment', [
      new TestAzureGateway(firstClose, firstCalls),
    ]);
    const secondRouter = new ModelRouterLanguageModel('azure-openai/gpt-5-4-deployment', [
      new TestAzureGateway(secondClose, secondCalls),
    ]);
    const streamOptions = {
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      providerOptions: {
        azure: {
          transport: 'websocket',
          websocket: { closeOnFinish: false },
        },
      },
    } as any;

    await firstRouter.doStream(streamOptions);
    await secondRouter.doStream(streamOptions);

    expect(firstCalls).toHaveLength(1);
    expect(secondCalls).toHaveLength(1);
    secondRouter._getStreamTransport()?.close();
    expect(firstClose).not.toHaveBeenCalled();
    expect(secondClose).toHaveBeenCalledTimes(1);
  });
});
