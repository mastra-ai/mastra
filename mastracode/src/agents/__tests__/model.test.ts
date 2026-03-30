import { createAnthropic } from '@ai-sdk/anthropic';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Clear the module registry so vi.mock factories take effect even when
// a previous test file (running under isolate:false) already cached the real modules.
vi.hoisted(() => vi.resetModules());

// Use vi.hoisted so the mock instance is available when vi.mock factory runs (hoisted above imports)
const mockAuthStorageInstance = vi.hoisted(() => ({
  reload: vi.fn(),
  get: vi.fn(),
  isLoggedIn: vi.fn().mockReturnValue(false),
  getStoredApiKey: vi.fn<(provider: string) => string | undefined>().mockReturnValue(undefined),
}));

vi.mock('../../auth/storage.js', () => {
  return {
    AuthStorage: class MockAuthStorage {
      reload = mockAuthStorageInstance.reload;
      get = mockAuthStorageInstance.get;
      isLoggedIn = mockAuthStorageInstance.isLoggedIn;
      getStoredApiKey = mockAuthStorageInstance.getStoredApiKey;
    },
  };
});

// Mock claude-max provider
vi.mock('../../providers/claude-max.js', () => ({
  opencodeClaudeMaxProvider: vi.fn(() => ({ __provider: 'claude-max-oauth' })),
  promptCacheMiddleware: { specificationVersion: 'v3', transformParams: vi.fn() },
}));

// Mock openai-codex provider
vi.mock('../../providers/openai-codex.js', () => ({
  openaiCodexProvider: vi.fn(() => ({ __provider: 'openai-codex' })),
}));

// Mock @ai-sdk/anthropic
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn((_opts: Record<string, unknown>) => {
    return (modelId: string) => ({ __provider: 'anthropic-direct', modelId });
  }),
}));

// Mock @ai-sdk/openai
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((_opts: Record<string, unknown>) => {
    const openai = ((modelId: string) => ({ __provider: 'openai-direct', modelId })) as unknown as {
      responses: (modelId: string) => Record<string, unknown>;
    };
    openai.responses = (modelId: string) => ({ __provider: 'openai-direct', modelId });
    return openai;
  }),
}));

// Mock ai SDK's wrapLanguageModel to pass through with a marker
vi.mock('ai', () => ({
  wrapLanguageModel: vi.fn(({ model }: { model: Record<string, unknown> }) => ({
    ...model,
    __wrapped: true,
  })),
}));

// Mock ModelRouterLanguageModel and MastraProxyGateway
vi.mock('@mastra/core/llm', () => ({
  ModelRouterLanguageModel: vi.fn(function (
    this: Record<string, unknown>,
    config: string | { id: string; url?: string; apiKey?: string; headers?: Record<string, string> },
    customGateways?: Array<{ baseUrl: string; headers?: Record<string, string> }>,
  ) {
    this.__provider = 'model-router';
    this.modelId = typeof config === 'string' ? config : config.id;
    this.url = typeof config === 'string' ? undefined : config.url;
    this.apiKey = typeof config === 'string' ? undefined : config.apiKey;
    this.headers = typeof config === 'string' ? undefined : config.headers;
    this.customGateways = customGateways;
  }),
  MastraProxyGateway: vi.fn(function (
    this: Record<string, unknown>,
    config: { baseUrl: string; headers?: Record<string, string> },
  ) {
    this.__type = 'proxy-gateway';
    this.baseUrl = config.baseUrl;
    this.headers = config.headers;
  }),
}));

const mockLoadSettings = vi.hoisted(() =>
  vi.fn<
    () => {
      customProviders: Array<{ name: string; url: string; apiKey?: string; headers?: Record<string, string> }>;
      llmProxy?: { baseUrl: string | null; headers: Record<string, string> };
      memoryGateway?: { baseUrl: string | null };
    }
  >(() => ({
    customProviders: [],
  })),
);

vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: mockLoadSettings,
  getCustomProviderId: (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
  LLM_PROXY_DEFAULTS: { baseUrl: null, headers: {} },
  MEMORY_GATEWAY_DEFAULTS: { baseUrl: null },
  MEMORY_GATEWAY_DEFAULT_URL: 'https://server.mastra.ai/v1',
  MEMORY_GATEWAY_PROVIDER: 'memory-gateway',
}));

import { opencodeClaudeMaxProvider } from '../../providers/claude-max.js';
import { openaiCodexProvider } from '../../providers/openai-codex.js';
import { resolveModel, getAnthropicApiKey, getOpenAIApiKey } from '../model.js';

function makeRequestContext({ threadId, resourceId }: { threadId?: string; resourceId?: string } = {}) {
  const requestContext = new RequestContext();
  requestContext.set('harness', {
    threadId,
    resourceId,
  });
  return requestContext;
}

describe('resolveModel', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockReturnValue({ customProviders: [] });
    mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MOONSHOT_AI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('anthropic/* models', () => {
    it('prefers Claude Max OAuth when stored OAuth credential exists', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      resolveModel('anthropic/claude-sonnet-4-20250514');

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', { headers: undefined });
    });

    it('uses API key when stored credential is api_key, even if isLoggedIn reports true', () => {
      mockAuthStorageInstance.isLoggedIn.mockImplementation((p: string) => p === 'anthropic');
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-stored-key-456' });

      const result = resolveModel('anthropic/claude-sonnet-4-20250514') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.__wrapped).toBe(true);
      expect(result.modelId).toBe('claude-sonnet-4-20250514');
      expect(opencodeClaudeMaxProvider).not.toHaveBeenCalled();
    });

    it('does not use env API key when no stored Anthropic credential exists', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key-123';
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      const result = resolveModel('anthropic/claude-sonnet-4-20250514') as Record<string, unknown>;

      expect(result.__provider).toBe('claude-max-oauth');
      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', { headers: undefined });
    });

    it('uses stored API key credential when not logged in via OAuth', () => {
      mockAuthStorageInstance.isLoggedIn.mockReturnValue(false);
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-stored-key-456' });

      const result = resolveModel('anthropic/claude-sonnet-4-20250514') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.__wrapped).toBe(true);
      expect(result.modelId).toBe('claude-sonnet-4-20250514');
      expect(opencodeClaudeMaxProvider).not.toHaveBeenCalled();
    });

    it('falls back to OAuth provider when no auth is configured (to prompt login)', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      resolveModel('anthropic/claude-sonnet-4-20250514');

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', { headers: undefined });
    });

    it('passes harness headers to the Anthropic OAuth provider', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      resolveModel('anthropic/claude-sonnet-4-20250514', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      });

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', {
        headers: {
          'x-thread-id': 'thread-123',
          'x-resource-id': 'resource-456',
        },
      });
    });

    it('reloads auth storage before resolving', () => {
      mockAuthStorageInstance.isLoggedIn.mockImplementation((p: string) => p === 'anthropic');
      resolveModel('anthropic/claude-sonnet-4-20250514');
      expect(mockAuthStorageInstance.reload).toHaveBeenCalled();
    });
  });

  describe('openai/* models', () => {
    it('uses codex provider when stored OAuth credential exists', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'openai-oauth-access-token',
        refresh: 'openai-oauth-refresh-token',
        expires: Date.now() + 60_000,
      });
      const result = resolveModel('openai/gpt-4o') as Record<string, unknown>;
      expect(result.__provider).toBe('openai-codex');
      expect(openaiCodexProvider).toHaveBeenCalled();
    });

    it('uses direct OpenAI API key provider when stored API key credential exists', () => {
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-openai-key' });
      const result = resolveModel('openai/gpt-4o') as Record<string, unknown>;
      expect(result.__provider).toBe('openai-direct');
      expect(result.__wrapped).toBe(true);
      expect(result.modelId).toBe('gpt-4o');
    });

    it('uses model router when no OpenAI auth is configured', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      const result = resolveModel('openai/gpt-4o') as Record<string, unknown>;
      expect(result.__provider).toBe('model-router');
    });

    it('passes harness headers to the OpenAI OAuth provider', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'openai-oauth-access-token',
        refresh: 'openai-oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      resolveModel('openai/gpt-4o', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      });

      expect(openaiCodexProvider).toHaveBeenCalledWith('gpt-4o', {
        thinkingLevel: undefined,
        headers: {
          'x-thread-id': 'thread-123',
          'x-resource-id': 'resource-456',
        },
      });
    });
  });

  describe('other providers', () => {
    it('uses model router for unknown providers', () => {
      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;
      expect(result.__provider).toBe('model-router');
    });

    it('passes harness headers to model router providers', () => {
      const result = resolveModel('google/gemini-2.0-flash', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      }) as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.headers).toEqual({
        'x-thread-id': 'thread-123',
        'x-resource-id': 'resource-456',
      });
    });

    it('passes harness headers to custom providers', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [
          {
            name: 'Acme',
            url: 'https://llm.acme.dev/v1',
            apiKey: 'acme-secret',
          },
        ],
      });

      const result = resolveModel('acme/reasoner-v1', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      }) as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.modelId).toBe('acme/reasoner-v1');
      expect(result.url).toBe('https://llm.acme.dev/v1');
      expect(result.apiKey).toBe('acme-secret');
      expect(result.headers).toEqual({
        'x-thread-id': 'thread-123',
        'x-resource-id': 'resource-456',
      });
    });

    it('does not leak proxy headers to custom provider URLs', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [
          {
            name: 'Acme',
            url: 'https://llm.acme.dev/v1',
            apiKey: 'acme-secret',
          },
        ],
        llmProxy: {
          baseUrl: 'https://proxy.corp.com',
          headers: { 'X-Proxy-Auth': 'token-789' },
        },
      });

      const result = resolveModel('acme/reasoner-v1') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.url).toBe('https://llm.acme.dev/v1');
      expect(result.headers).toBeUndefined();
    });

    it('does not leak memory gateway headers to custom provider URLs', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [
          {
            name: 'Acme',
            url: 'https://llm.acme.dev/v1',
            apiKey: 'acme-secret',
          },
        ],
        memoryGateway: { baseUrl: null },
      });

      const result = resolveModel('acme/reasoner-v1') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.url).toBe('https://llm.acme.dev/v1');
      expect(result.headers).toBeUndefined();
    });
  });

  describe('LLM proxy configuration', () => {
    it('passes proxy baseUrl and headers to Anthropic OAuth provider', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: {
          baseUrl: 'https://proxy.corp.com',
          headers: { 'X-Proxy-Auth': 'token-123' },
        },
      });
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      resolveModel('anthropic/claude-sonnet-4-20250514');

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', {
        baseURL: 'https://proxy.corp.com',
        headers: { 'X-Proxy-Auth': 'token-123' },
      });
    });

    it('passes proxy baseUrl and headers to OpenAI OAuth provider', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: {
          baseUrl: 'https://proxy.corp.com',
          headers: { 'X-Proxy-Auth': 'token-456' },
        },
      });
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'openai-oauth-access-token',
        refresh: 'openai-oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      resolveModel('openai/gpt-4o');

      expect(openaiCodexProvider).toHaveBeenCalledWith('gpt-4o', {
        thinkingLevel: undefined,
        baseURL: 'https://proxy.corp.com',
        headers: { 'X-Proxy-Auth': 'token-456' },
      });
    });

    it('passes proxy gateway to model router for unknown providers', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: {
          baseUrl: 'https://proxy.corp.com',
          headers: {},
        },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      // Proxy is now passed as a custom gateway, not as url
      expect(result.url).toBeUndefined();
      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].__type).toBe('proxy-gateway');
      expect(gateways![0].baseUrl).toBe('https://proxy.corp.com');
    });

    it('passes proxy headers via gateway and harness headers via config', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: {
          baseUrl: 'https://proxy.corp.com',
          headers: { 'x-thread-id': 'proxy-thread', 'X-Proxy-Auth': 'token-789' },
        },
      });

      const result = resolveModel('google/gemini-2.0-flash', {
        requestContext: makeRequestContext({ threadId: 'harness-thread' }),
      }) as Record<string, unknown>;

      // Harness headers go on config; proxy headers are in the gateway
      expect(result.headers).toEqual({
        'x-thread-id': 'harness-thread',
      });
      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].headers).toEqual({
        'x-thread-id': 'proxy-thread',
        'X-Proxy-Auth': 'token-789',
      });
    });

    it('ignores proxy headers when proxy baseUrl is null', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: {
          baseUrl: null,
          headers: { 'X-Proxy-Auth': 'token-789' },
        },
      });

      const result = resolveModel('google/gemini-2.0-flash', {
        requestContext: makeRequestContext({ threadId: 'harness-thread' }),
      }) as Record<string, unknown>;

      expect(result.headers).toEqual({
        'x-thread-id': 'harness-thread',
      });
    });

    it('does not set url when proxy baseUrl is null', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: { baseUrl: null, headers: {} },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.url).toBeUndefined();
    });

    it('passes proxy baseUrl to Anthropic API key provider', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: {
          baseUrl: 'https://proxy.corp.com',
          headers: {},
        },
      });
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-test-key' });

      resolveModel('anthropic/claude-sonnet-4-20250514');

      expect(vi.mocked(createAnthropic)).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://proxy.corp.com',
        }),
      );
    });
  });

  describe('memory gateway', () => {
    beforeEach(() => {
      process.env.ENABLE_MASTRA_MEMORY_GATEWAY = 'true';
    });

    afterEach(() => {
      delete process.env.ENABLE_MASTRA_MEMORY_GATEWAY;
    });

    it('uses memory gateway as proxy gateway when apiKey is stored', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: null },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      // No url on config — routing is handled by the proxy gateway
      expect(result.url).toBeUndefined();
      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].__type).toBe('proxy-gateway');
      expect(gateways![0].baseUrl).toBe('https://server.mastra.ai/v1');
      expect(gateways![0].headers).toEqual({
        'X-Mastra-Authorization': 'Bearer msk_test123',
      });
    });

    it('uses custom memory gateway baseUrl when set', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: 'https://custom-gw.example.com' },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].baseUrl).toBe('https://custom-gw.example.com');
      expect(gateways![0].headers).toEqual({
        'X-Mastra-Authorization': 'Bearer msk_test123',
      });
    });

    it('supersedes llm-proxy when both are configured', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: { baseUrl: 'https://proxy.corp.com', headers: { 'X-Proxy': 'yes' } },
        memoryGateway: { baseUrl: null },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      // Memory gateway wins — llm-proxy URL and headers are ignored
      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].baseUrl).toBe('https://server.mastra.ai/v1');
      expect(gateways![0].headers).toEqual({
        'X-Mastra-Authorization': 'Bearer msk_test123',
      });
    });

    it('passes X-Mastra-Authorization via gateway and harness headers via config', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: null },
      });

      const result = resolveModel('google/gemini-2.0-flash', {
        requestContext: makeRequestContext({ threadId: 'thread-1' }),
      }) as Record<string, unknown>;

      // Harness headers on config
      expect(result.headers).toEqual({
        'x-thread-id': 'thread-1',
      });
      // Proxy headers on gateway
      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].headers).toEqual({
        'X-Mastra-Authorization': 'Bearer msk_test123',
      });
    });

    it('passes memory gateway URL to Anthropic OAuth provider', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: null },
      });
      mockAuthStorageInstance.get.mockReturnValue({ type: 'oauth' });

      resolveModel('anthropic/claude-sonnet-4-20250514');

      expect(vi.mocked(opencodeClaudeMaxProvider)).toHaveBeenCalledWith('claude-sonnet-4-20250514', {
        baseURL: 'https://server.mastra.ai/v1',
        headers: { 'X-Mastra-Authorization': 'Bearer msk_test123' },
      });
    });

    it('passes memory gateway URL to OpenAI OAuth provider', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: null },
      });
      mockAuthStorageInstance.get.mockReturnValue({ type: 'oauth' });

      resolveModel('openai/gpt-4o');

      expect(vi.mocked(openaiCodexProvider)).toHaveBeenCalledWith('gpt-4o', {
        baseURL: 'https://server.mastra.ai/v1',
        headers: { 'X-Mastra-Authorization': 'Bearer msk_test123' },
        thinkingLevel: undefined,
      });
    });

    it('falls back to llm-proxy gateway when no memory gateway apiKey is stored', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        llmProxy: { baseUrl: 'https://proxy.corp.com', headers: { 'X-Proxy': 'yes' } },
        memoryGateway: { baseUrl: null },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      expect(result.url).toBeUndefined();
      const gateways = result.customGateways as Array<Record<string, unknown>> | undefined;
      expect(gateways).toHaveLength(1);
      expect(gateways![0].baseUrl).toBe('https://proxy.corp.com');
      expect(gateways![0].headers).toEqual({ 'X-Proxy': 'yes' });
    });

    it('ignores memory gateway when ENABLE_MASTRA_MEMORY_GATEWAY is not set', () => {
      delete process.env.ENABLE_MASTRA_MEMORY_GATEWAY;
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_test123');
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: null },
      });

      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;

      // Falls through to model router with no proxy gateway
      expect(result.__provider).toBe('model-router');
      expect(result.customGateways).toBeUndefined();
    });
  });
});

describe('getAnthropicApiKey', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns stored API key when set', () => {
    mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-stored-key' });
    expect(getAnthropicApiKey()).toBe('sk-stored-key');
  });

  it('returns undefined when no API key is available', () => {
    mockAuthStorageInstance.get.mockReturnValue(undefined);
    expect(getAnthropicApiKey()).toBeUndefined();
  });

  it('returns undefined when stored credential is OAuth type', () => {
    mockAuthStorageInstance.get.mockReturnValue({ type: 'oauth', access: 'token', refresh: 'r', expires: 0 });
    expect(getAnthropicApiKey()).toBeUndefined();
  });

  it('ignores env var when no stored credential exists', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env-key';
    mockAuthStorageInstance.get.mockReturnValue(undefined);
    expect(getAnthropicApiKey()).toBeUndefined();
  });
});

describe('getOpenAIApiKey', () => {
  it('returns stored API key when set', () => {
    mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-openai-key' });
    expect(getOpenAIApiKey()).toBe('sk-openai-key');
  });

  it('returns undefined when no API key is available', () => {
    mockAuthStorageInstance.get.mockReturnValue(undefined);
    expect(getOpenAIApiKey()).toBeUndefined();
  });

  it('returns undefined when stored credential is OAuth type', () => {
    mockAuthStorageInstance.get.mockReturnValue({ type: 'oauth', access: 'token', refresh: 'r', expires: 0 });
    expect(getOpenAIApiKey()).toBeUndefined();
  });
});
