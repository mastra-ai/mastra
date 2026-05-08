// Clear the module registry so vi.mock factories take effect even when
// a previous test file (running under isolate:false) already cached the real modules.
vi.hoisted(() => vi.resetModules());

// Use vi.hoisted so the mock instance is available when vi.mock factory runs (hoisted above imports)
const mockAuthStorageInstance = vi.hoisted(() => ({
  reload: vi.fn(),
  get: vi.fn(),
  getStoredApiKey: vi.fn().mockReturnValue(undefined),
  isLoggedIn: vi.fn().mockReturnValue(false),
}));

vi.mock('../../auth/storage.js', () => {
  return {
    AuthStorage: class MockAuthStorage {
      reload = mockAuthStorageInstance.reload;
      get = mockAuthStorageInstance.get;
      getStoredApiKey = mockAuthStorageInstance.getStoredApiKey;
      isLoggedIn = mockAuthStorageInstance.isLoggedIn;
    },
  };
});

// Mock claude-max provider
const mockAnthropicOAuthFetch = vi.hoisted(() => vi.fn());
vi.mock('../../providers/claude-max.js', () => ({
  opencodeClaudeMaxProvider: vi.fn(() => ({ __provider: 'claude-max-oauth' })),
  claudeCodeMiddleware: { specificationVersion: 'v3', transformParams: vi.fn() },
  promptCacheMiddleware: { specificationVersion: 'v3', transformParams: vi.fn() },
  buildAnthropicOAuthFetch: vi.fn(() => mockAnthropicOAuthFetch),
}));

// Mock openai-codex provider
const mockCodexOAuthFetch = vi.hoisted(() => vi.fn());
vi.mock('../../providers/openai-codex.js', () => ({
  openaiCodexProvider: vi.fn(() => ({ __provider: 'openai-codex' })),
  buildOpenAICodexOAuthFetch: vi.fn(() => mockCodexOAuthFetch),
  createCodexMiddleware: vi.fn((effort?: string) => ({ __middleware: 'codex', effort })),
  getEffectiveThinkingLevel: vi.fn((_modelId: string, level: string) => level),
  THINKING_LEVEL_TO_REASONING_EFFORT: {
    off: undefined,
    low: 'low',
    medium: 'medium',
    high: 'high',
    xhigh: 'xhigh',
  },
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

// Mock ModelRouterLanguageModel and MastraGateway
vi.mock('@mastra/core/llm', () => ({
  ModelRouterLanguageModel: vi.fn(function (
    this: Record<string, unknown>,
    config: string | { id: string; url?: string; apiKey?: string; headers?: Record<string, string> },
    customGateways?: unknown[],
  ) {
    this.__provider = 'model-router';
    this.modelId = typeof config === 'string' ? config : config.id;
    this.url = typeof config === 'string' ? undefined : config.url;
    this.apiKey = typeof config === 'string' ? undefined : config.apiKey;
    this.headers = typeof config === 'string' ? undefined : config.headers;
    this.customGateways = customGateways;
  }),
  MastraGateway: vi.fn(function (
    this: Record<string, unknown>,
    config?: { apiKey?: string; baseUrl?: string; customFetch?: unknown },
  ) {
    this.__gateway = 'mastra';
    this.apiKey = config?.apiKey;
    this.baseUrl = config?.baseUrl;
    this.customFetch = config?.customFetch;
  }),
  GATEWAY_AUTH_HEADER: 'X-Memory-Gateway-Authorization',
}));

const mockLoadSettings = vi.hoisted(() =>
  vi.fn<
    () => {
      customProviders: Array<{ name: string; url: string; apiKey?: string }>;
      memoryGateway: { baseUrl?: string };
    }
  >(() => ({
    customProviders: [],
    memoryGateway: {},
  })),
);

vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: mockLoadSettings,
  getCustomProviderId: (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
  MEMORY_GATEWAY_PROVIDER: 'mastra-gateway',
  MEMORY_GATEWAY_DEFAULT_URL: 'https://gateway-api.mastra.ai',
}));

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { MastraGateway, ModelRouterLanguageModel } from '@mastra/core/llm';
import { RequestContext } from '@mastra/core/request-context';
import { wrapLanguageModel } from 'ai';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { opencodeClaudeMaxProvider, buildAnthropicOAuthFetch } from '../../providers/claude-max.js';
import { openaiCodexProvider, buildOpenAICodexOAuthFetch } from '../../providers/openai-codex.js';
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
    mockLoadSettings.mockReturnValue({ customProviders: [], memoryGateway: {} });
    mockAuthStorageInstance.get.mockReturnValue(undefined);
    mockAuthStorageInstance.isLoggedIn.mockReturnValue(false);
    mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MOONSHOT_AI_API_KEY;
    delete process.env.MASTRA_GATEWAY_URL;
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

    it('falls back to env API key when no stored Anthropic credential exists', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key-123';
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      const result = resolveModel('anthropic/claude-sonnet-4-20250514') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.__wrapped).toBe(true);
      expect(result.modelId).toBe('claude-sonnet-4-20250514');
      expect(opencodeClaudeMaxProvider).not.toHaveBeenCalled();
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

    it('normalizes Anthropic OAuth model ids to dash-separated names', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      resolveModel('anthropic/claude-opus-4.6');

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-opus-4-6', { headers: undefined });
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
        memoryGateway: {},
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
  });

  describe('memory gateway enabled (gateway API key stored)', () => {
    beforeEach(() => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue('msk_gateway_key_123');
    });

    it('routes explicit mastra-prefixed anthropic model through gateway', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.modelId).toBe('mastra/anthropic/claude-sonnet-4');
      expect(MastraGateway).toHaveBeenCalledWith({
        apiKey: 'msk_gateway_key_123',
        baseUrl: 'https://gateway-api.mastra.ai',
      });
      expect(ModelRouterLanguageModel).toHaveBeenCalledWith(
        { id: 'mastra/anthropic/claude-sonnet-4', headers: undefined },
        [expect.objectContaining({ __gateway: 'mastra', apiKey: 'msk_gateway_key_123' })],
      );
    });

    it('routes explicit mastra-prefixed anthropic OAuth model directly with middleware (bypasses ModelRouterLanguageModel)', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      // Should use createAnthropic directly, NOT go through ModelRouterLanguageModel
      expect(createAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: 'https://gateway-api.mastra.ai/v1',
          fetch: mockAnthropicOAuthFetch,
        }),
      );
      const opts = vi.mocked(createAnthropic).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect((opts?.headers as Record<string, string>)?.['X-Memory-Gateway-Authorization']).toBe(
        'Bearer msk_gateway_key_123',
      );
      // Should wrap with middleware
      expect(wrapLanguageModel).toHaveBeenCalled();
      expect(result.__wrapped).toBe(true);
      expect(result.__provider).toBe('anthropic-direct');
      expect(result.modelId).toBe('claude-sonnet-4');
      // Should NOT use ModelRouterLanguageModel or MastraGateway
      expect(MastraGateway).not.toHaveBeenCalled();
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();
      expect(opencodeClaudeMaxProvider).not.toHaveBeenCalled();
    });

    it('normalizes mastra-prefixed anthropic OAuth model ids to dash-separated names', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      const result = resolveModel('mastra/anthropic/claude-opus-4.6') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.__wrapped).toBe(true);
      expect(result.modelId).toBe('claude-opus-4-6');
      expect(MastraGateway).not.toHaveBeenCalled();
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();
    });

    it('routes explicit mastra-prefixed openai OAuth model directly with Codex middleware (bypasses ModelRouterLanguageModel)', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'openai-oauth-access-token',
        refresh: 'openai-oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      const result = resolveModel('mastra/openai/gpt-4o') as Record<string, unknown>;

      // Should use createOpenAI directly, NOT go through ModelRouterLanguageModel
      expect(createOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'oauth-gateway-placeholder',
          baseURL: 'https://gateway-api.mastra.ai/v1',
          fetch: mockCodexOAuthFetch,
        }),
      );
      const opts = vi.mocked(createOpenAI).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect((opts?.headers as Record<string, string>)?.['X-Memory-Gateway-Authorization']).toBe(
        'Bearer msk_gateway_key_123',
      );
      expect(buildOpenAICodexOAuthFetch).toHaveBeenCalledWith({
        authStorage: expect.anything(),
        rewriteUrl: false,
      });
      // Should wrap with middleware
      expect(wrapLanguageModel).toHaveBeenCalled();
      expect(result.__wrapped).toBe(true);
      expect(result.__provider).toBe('openai-direct');
      expect(result.modelId).toBe('gpt-4o');
      // Should NOT use ModelRouterLanguageModel or MastraGateway
      expect(MastraGateway).not.toHaveBeenCalled();
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();
      expect(openaiCodexProvider).not.toHaveBeenCalled();
    });

    it('routes explicit mastra-prefixed anthropic API key model through gateway without customFetch', () => {
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-stored-key' });

      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.modelId).toBe('mastra/anthropic/claude-sonnet-4');
      expect(MastraGateway).toHaveBeenCalledWith({
        apiKey: 'msk_gateway_key_123',
        baseUrl: 'https://gateway-api.mastra.ai',
      });
      expect(buildAnthropicOAuthFetch).not.toHaveBeenCalled();
    });

    it('routes explicit mastra-prefixed unknown provider through gateway', () => {
      const result = resolveModel('mastra/google/gemini-2.0-flash') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.modelId).toBe('mastra/google/gemini-2.0-flash');
      expect(MastraGateway).toHaveBeenCalledWith({
        apiKey: 'msk_gateway_key_123',
        baseUrl: 'https://gateway-api.mastra.ai',
      });
    });

    it('custom provider bypasses gateway', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [{ name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'acme-secret' }],
        memoryGateway: {},
      });

      const result = resolveModel('acme/reasoner-v1') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.modelId).toBe('acme/reasoner-v1');
      expect(result.url).toBe('https://llm.acme.dev/v1');
      expect(MastraGateway).not.toHaveBeenCalled();
    });

    it('passes baseUrl when explicitly set in settings for explicit mastra-prefixed models', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: 'https://custom-gateway.example.com' },
      });
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      resolveModel('mastra/anthropic/claude-sonnet-4');

      expect(MastraGateway).toHaveBeenCalledWith({
        apiKey: 'msk_gateway_key_123',
        baseUrl: 'https://custom-gateway.example.com',
      });
    });

    it('uses default baseUrl when not set in settings for explicit mastra-prefixed models', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: {},
      });
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      resolveModel('mastra/anthropic/claude-sonnet-4');

      expect(MastraGateway).toHaveBeenCalledWith({
        apiKey: 'msk_gateway_key_123',
        baseUrl: 'https://gateway-api.mastra.ai',
      });
    });

    it('passes harness headers to ModelRouterLanguageModel for explicit mastra-prefixed models', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      resolveModel('mastra/anthropic/claude-sonnet-4', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      });

      expect(ModelRouterLanguageModel).toHaveBeenCalledWith(
        {
          id: 'mastra/anthropic/claude-sonnet-4',
          headers: { 'x-thread-id': 'thread-123', 'x-resource-id': 'resource-456' },
        },
        expect.any(Array),
      );
    });

    it('skips gateway when no API key is stored and no env var', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      delete process.env['MASTRA_GATEWAY_API_KEY'];

      resolveModel('anthropic/claude-sonnet-4');

      expect(MastraGateway).not.toHaveBeenCalled();
      // Falls through to normal flow
      expect(opencodeClaudeMaxProvider).toHaveBeenCalled();
    });

    it('does not route plain provider/model ids through the gateway just because MASTRA_GATEWAY_API_KEY is set', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      process.env['MASTRA_GATEWAY_API_KEY'] = 'msk_env_key';

      resolveModel('anthropic/claude-sonnet-4');

      expect(MastraGateway).not.toHaveBeenCalled();
      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4', { headers: undefined });
      delete process.env['MASTRA_GATEWAY_API_KEY'];
    });

    it('routes explicit mastra-prefixed ids through the gateway when MASTRA_GATEWAY_API_KEY is set', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      process.env['MASTRA_GATEWAY_API_KEY'] = 'msk_env_key';

      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.modelId).toBe('mastra/anthropic/claude-sonnet-4');
      expect(MastraGateway).toHaveBeenCalledWith({ apiKey: 'msk_env_key', baseUrl: 'https://gateway-api.mastra.ai' });
      delete process.env['MASTRA_GATEWAY_API_KEY'];
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

  it('falls back to env var when no stored credential exists', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env-key';
    mockAuthStorageInstance.get.mockReturnValue(undefined);
    expect(getAnthropicApiKey()).toBe('sk-env-key');
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
