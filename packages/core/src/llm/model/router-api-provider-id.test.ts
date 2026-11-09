import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockModel } from '../../test-utils/llm-mock.js';
import { MASTRA_GATEWAY_STREAM_TRANSPORT, MastraModelGateway } from './gateways/base.js';
import type { GatewayLanguageModel, ProviderConfig } from './gateways/base.js';
import { ModelRouterLanguageModel, resolveApiProviderId } from './router.js';

describe('resolveApiProviderId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports the Chat Completions model a custom URL resolves to', async () => {
    const router = new ModelRouterLanguageModel({ id: 'vllm/qwen', url: 'http://localhost:9999/v1', apiKey: 'k' });
    expect(router.provider).toBe('vllm');
    expect(await resolveApiProviderId(router)).toBe('vllm.chat');
  });

  it('reports the Responses model a custom URL with api "responses" resolves to', async () => {
    const router = new ModelRouterLanguageModel({
      id: 'vllm/qwen',
      url: 'http://localhost:9999/v1',
      apiKey: 'k',
      api: 'responses',
    });
    expect(await resolveApiProviderId(router)).toBe('openai.responses');
  });

  it('tells gateway Chat Completions providers from Responses ones', async () => {
    vi.stubEnv('GROQ_API_KEY', 'k');
    vi.stubEnv('OPENAI_API_KEY', 'k');
    vi.stubEnv('XAI_API_KEY', 'k');
    expect(await resolveApiProviderId(new ModelRouterLanguageModel('groq/llama-3.3-70b-versatile'))).toBe('groq.chat');
    expect(await resolveApiProviderId(new ModelRouterLanguageModel('openai/gpt-4o'))).toBe('openai.responses');
    expect(await resolveApiProviderId(new ModelRouterLanguageModel('xai/grok-4'))).toBe('xai.responses');
  });

  it('returns undefined when the model cannot be resolved', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    expect(await resolveApiProviderId(new ModelRouterLanguageModel('groq/llama-3.3-70b-versatile'))).toBeUndefined();
  });

  it("returns a non-router model's own provider", async () => {
    expect(await resolveApiProviderId(createMockModel({ mockText: 'x' }))).toBe('mock-provider');
    expect(await resolveApiProviderId(undefined)).toBeUndefined();
  });

  it('resolves again when the gateway resolves a different model', async () => {
    let apiKey = 'chat-key';
    class SwitchingGateway extends MastraModelGateway {
      readonly id = 'switching';
      readonly name = 'switching';
      fetchProviders(): Promise<Record<string, ProviderConfig>> {
        return Promise.resolve({
          switching: { name: 'Switching', models: ['m'], apiKeyEnvVar: [], gateway: 'switching' },
        });
      }
      buildUrl(): undefined {
        return undefined;
      }
      getApiKey(): Promise<string> {
        return Promise.resolve(apiKey);
      }
      resolveLanguageModel(args: { apiKey: string }): GatewayLanguageModel {
        const model = createMockModel({ mockText: 'x' }) as GatewayLanguageModel;
        Object.defineProperty(model, 'provider', {
          value: args.apiKey === 'chat-key' ? 'switching.chat' : 'switching.responses',
        });
        return model;
      }
    }
    const router = new ModelRouterLanguageModel('switching/m', [new SwitchingGateway()]);

    expect(await router.resolveApiProviderId()).toBe('switching.chat');
    apiKey = 'responses-key';
    expect(await router.resolveApiProviderId()).toBe('switching.responses');
  });

  it('leaves the transport handle of the last stream in place', async () => {
    const close = vi.fn();
    class TestAzureGateway extends MastraModelGateway {
      readonly id = 'azure-openai';
      readonly name = 'azure-openai';
      fetchProviders(): Promise<Record<string, ProviderConfig>> {
        return Promise.resolve({
          'azure-openai': { name: 'Azure OpenAI', models: ['dep'], apiKeyEnvVar: [], gateway: 'azure-openai' },
        });
      }
      buildUrl(): undefined {
        return undefined;
      }
      getApiKey(): Promise<string> {
        return Promise.resolve('k');
      }
      resolveLanguageModel(args: { transport?: string }): GatewayLanguageModel {
        const model = createMockModel({ mockText: 'x' }) as GatewayLanguageModel;
        if (args.transport === 'websocket') {
          Object.defineProperty(model, MASTRA_GATEWAY_STREAM_TRANSPORT, {
            value: { type: 'openai-websocket', close },
          });
        }
        return model;
      }
    }
    const router = new ModelRouterLanguageModel('azure-openai/dep', [new TestAzureGateway()]);

    await router.doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      providerOptions: { azure: { transport: 'websocket' } },
    } as any);
    expect(router._getStreamTransport()).toMatchObject({ type: 'openai-websocket' });

    await router.resolveApiProviderId();

    expect(router._getStreamTransport()).toMatchObject({ type: 'openai-websocket' });
  });
});
