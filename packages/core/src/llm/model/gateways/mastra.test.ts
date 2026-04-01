import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createOpenRouter } from '@openrouter/ai-sdk-provider-v5';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraGateway } from './mastra';

vi.mock('@ai-sdk/anthropic-v5', () => {
  const anthropicModelMock = vi.fn().mockReturnValue({ modelId: 'mock-anthropic-model' });
  const createAnthropicMock = vi.fn().mockReturnValue(anthropicModelMock);
  return { createAnthropic: createAnthropicMock };
});

vi.mock('@openrouter/ai-sdk-provider-v5', () => {
  const chatMock = vi.fn().mockReturnValue({ modelId: 'mock-model' });
  const createOpenRouterMock = vi.fn().mockReturnValue({ chat: chatMock });
  return { createOpenRouter: createOpenRouterMock };
});

const createAnthropicMock = vi.mocked(createAnthropic);
const anthropicModelMock = vi.mocked(createAnthropicMock() as unknown as ReturnType<typeof vi.fn>);
const createOpenRouterMock = vi.mocked(createOpenRouter);
const chatMock = vi.mocked(createOpenRouterMock().chat);

describe('MastraGateway', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('works with no arguments', () => {
      const gw = new MastraGateway();
      expect(gw.id).toBe('mastra');
      expect(gw.name).toBe('Mastra Gateway');
    });

    it('accepts config object', () => {
      const gw = new MastraGateway({ apiKey: 'test-key', baseUrl: 'https://custom.example.com' });
      expect(gw.id).toBe('mastra');
    });
  });

  describe('shouldEnable', () => {
    it('reports disabled when MASTRA_GATEWAY_API_KEY is not set', () => {
      delete process.env['MASTRA_GATEWAY_API_KEY'];

      const gw = new MastraGateway();

      expect(gw.shouldEnable()).toBe(false);
    });

    it('reports enabled when MASTRA_GATEWAY_API_KEY is set', () => {
      process.env['MASTRA_GATEWAY_API_KEY'] = 'test-key';

      const gw = new MastraGateway();

      expect(gw.shouldEnable()).toBe(true);
    });
  });

  describe('getApiKey', () => {
    it('returns config apiKey over env var', async () => {
      process.env['MASTRA_GATEWAY_API_KEY'] = 'env-key';
      const gw = new MastraGateway({ apiKey: 'config-key' });
      expect(await gw.getApiKey()).toBe('config-key');
    });

    it('falls back to env var when no config apiKey', async () => {
      process.env['MASTRA_GATEWAY_API_KEY'] = 'env-key';
      const gw = new MastraGateway();
      expect(await gw.getApiKey()).toBe('env-key');
    });

    it('throws when neither config nor env var is set', async () => {
      delete process.env['MASTRA_GATEWAY_API_KEY'];
      const gw = new MastraGateway();
      await expect(gw.getApiKey()).rejects.toThrow('Missing MASTRA_GATEWAY_API_KEY');
    });
  });

  describe('buildUrl', () => {
    it('uses config baseUrl', async () => {
      const gw = new MastraGateway({ baseUrl: 'https://custom.example.com' });
      expect(await gw.buildUrl('test')).toBe('https://custom.example.com/v1');
    });

    it('uses env var when no config baseUrl', async () => {
      process.env['MASTRA_GATEWAY_URL'] = 'https://env.example.com';
      const gw = new MastraGateway();
      expect(await gw.buildUrl('test')).toBe('https://env.example.com/v1');
    });

    it('uses default when neither config nor env var', async () => {
      delete process.env['MASTRA_GATEWAY_URL'];
      const gw = new MastraGateway();
      expect(await gw.buildUrl('test')).toBe('https://server.mastra.ai/v1');
    });

    it('config baseUrl takes precedence over env var', async () => {
      process.env['MASTRA_GATEWAY_URL'] = 'https://env.example.com';
      const gw = new MastraGateway({ baseUrl: 'https://config.example.com' });
      expect(await gw.buildUrl('test')).toBe('https://config.example.com/v1');
    });
  });

  describe('resolveLanguageModel', () => {
    const args = { modelId: 'claude-sonnet-4', providerId: 'anthropic', apiKey: 'gw-key' };

    it('without customFetch — passes apiKey directly', () => {
      const gw = new MastraGateway();
      gw.resolveLanguageModel(args);

      expect(createOpenRouterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'gw-key',
          baseURL: 'https://server.mastra.ai/v1',
        }),
      );
      const call = createOpenRouterMock.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      const callHeaders = call!.headers as Record<string, string>;
      expect(callHeaders['X-Memory-Gateway-Authorization']).toBeUndefined();
      expect(call?.fetch).toBeUndefined();
      expect(chatMock).toHaveBeenCalledWith('anthropic/claude-sonnet-4');
    });

    it('with customFetch + anthropic — uses Anthropic SDK and gateway auth header', () => {
      const customFetch = vi.fn() as unknown as typeof fetch;
      const gw = new MastraGateway({ customFetch, baseUrl: 'https://gw.example.com' });
      gw.resolveLanguageModel({ ...args, headers: { 'x-thread-id': 'thread-123' } });

      expect(createAnthropicMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: 'https://gw.example.com/v1',
          fetch: customFetch,
        }),
      );
      const call = createAnthropicMock.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      const callHeaders = call!.headers as Record<string, string>;
      expect(callHeaders['X-Memory-Gateway-Authorization']).toBe('Bearer gw-key');
      expect(callHeaders['x-thread-id']).toBe('thread-123');
      expect(anthropicModelMock).toHaveBeenCalledWith('claude-sonnet-4');
    });

    it('with customFetch + non-anthropic — uses OpenRouter chat and gateway auth header', () => {
      const customFetch = vi.fn() as unknown as typeof fetch;
      const gw = new MastraGateway({ customFetch, baseUrl: 'https://gw.example.com' });
      gw.resolveLanguageModel({ modelId: 'gpt-4.1', providerId: 'openai', apiKey: 'gw-key' });

      expect(createOpenRouterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: 'https://gw.example.com/v1',
          fetch: customFetch,
        }),
      );
      const call = createOpenRouterMock.mock.calls[0]?.[0];
      expect(call).toBeDefined();
      const callHeaders = call!.headers as Record<string, string>;
      expect(callHeaders['X-Memory-Gateway-Authorization']).toBe('Bearer gw-key');
      expect(chatMock).toHaveBeenCalledWith('openai/gpt-4.1');
    });
  });

  describe('fetchProviders', () => {
    it('returns no providers when MASTRA_GATEWAY_API_KEY is not set', async () => {
      delete process.env['MASTRA_GATEWAY_API_KEY'];

      const gw = new MastraGateway();
      const providers = await gw.fetchProviders();

      expect(providers).toEqual({});
    });

    it('returns mastra provider with openrouter models when enabled', async () => {
      process.env['MASTRA_GATEWAY_API_KEY'] = 'test-key';

      const gw = new MastraGateway();
      const providers = await gw.fetchProviders();

      expect(providers['mastra']).toBeDefined();
      expect(providers['mastra'].gateway).toBe('mastra');
      expect(providers['mastra'].apiKeyEnvVar).toBe('MASTRA_GATEWAY_API_KEY');
    });
  });
});
