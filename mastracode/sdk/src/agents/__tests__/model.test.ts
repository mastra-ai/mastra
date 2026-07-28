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
      constructor() {
        // Every construction resolves to the shared singleton so tests can
        // assert the exact instance handed to provider factories.
        return mockAuthStorageInstance as unknown as MockAuthStorage;
      }
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

const mockGetCopilotModelCatalog = vi.hoisted(() => vi.fn(async () => []));
vi.mock('../../providers/github-copilot.js', () => ({
  githubCopilotProvider: vi.fn(() => ({ __provider: 'github-copilot' })),
  getCopilotModelCatalog: mockGetCopilotModelCatalog,
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

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: vi.fn((opts: Record<string, unknown>) => ({
    chatModel: (modelId: string) => ({
      __provider: 'custom-openai-compatible',
      modelId,
      url: opts.baseURL,
      apiKey: opts.apiKey,
      headers: opts.headers,
    }),
  })),
}));

// Mock @ai-sdk/amazon-bedrock
vi.mock('@ai-sdk/amazon-bedrock', () => ({
  createAmazonBedrock: vi.fn((opts: Record<string, unknown>) => {
    return (modelId: string) => ({
      __provider: 'amazon-bedrock',
      modelId,
      region: opts.region,
      credentialProvider: opts.credentialProvider,
      headers: opts.headers,
    });
  }),
}));

// Mock @aws-sdk/credential-providers
const mockCredentialProvider = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: vi.fn(() => mockCredentialProvider),
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
  MastraModelGateway: class MockMastraModelGateway {},
  PROVIDER_REGISTRY: {},
  ModelRouterLanguageModel: vi.fn(function (
    this: Record<string, unknown>,
    config: string | { id: string; url?: string; apiKey?: string; headers?: Record<string, string> },
    customGateways?: Array<Record<string, any>>,
  ) {
    const id = typeof config === 'string' ? config : config.id;
    this.__provider = 'model-router';
    this.modelId = id;
    this.url = typeof config === 'string' ? undefined : config.url;
    this.apiKey = typeof config === 'string' ? undefined : config.apiKey;
    this.headers = typeof config === 'string' ? undefined : config.headers;
    this.customGateways = customGateways;

    const gateway = customGateways?.[0];
    if (!gateway || !id.startsWith(`${gateway.id}/`)) return;

    const [, providerId, ...modelParts] = id.split('/');
    const modelId = modelParts.join('/');
    const auth = gateway.resolveAuth?.({ gatewayId: gateway.id, providerId, modelId, routerId: id });
    const resolved = gateway.resolveLanguageModel({
      providerId,
      modelId,
      apiKey: auth?.apiKey ?? this.apiKey ?? '',
      headers: this.headers,
    });
    Object.assign(this, resolved);
  }),
  MastraGateway: vi.fn(function (
    this: Record<string, unknown>,
    config?: { apiKey?: string; baseUrl?: string; customFetch?: unknown },
  ) {
    this.__gateway = 'mastra';
    this.apiKey = config?.apiKey;
    this.baseUrl = config?.baseUrl;
    this.customFetch = config?.customFetch;
    this.resolveLanguageModel = vi.fn((args: Record<string, unknown>) => ({
      __provider: 'mastra-gateway-delegate',
      args,
    }));
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
  MASTRA_GATEWAY_PROVIDER: 'mastra-gateway',
  MASTRA_GATEWAY_DEFAULT_URL: 'https://gateway-api.mastra.ai',
}));

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { MastraGateway, ModelRouterLanguageModel } from '@mastra/core/llm';
import { wrapLanguageModel } from 'ai';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MODEL_TOKENS } from '../../../../../docs/src/plugins/remark-model-tokens/models.js';
import { opencodeClaudeMaxProvider, buildAnthropicOAuthFetch } from '../../providers/claude-max.js';
import { openaiCodexProvider, buildOpenAICodexOAuthFetch } from '../../providers/openai-codex.js';
import {
  createMastraCodeGateway,
  resolveModel,
  getDynamicModel,
  getAnthropicApiKey,
  getOpenAIApiKey,
  MastraCodeGateway,
  resolveAuth,
} from '../model.js';

function makeRequestContext({ threadId, resourceId }: { threadId?: string; resourceId?: string } = {}) {
  const values = new Map<string, unknown>();
  const requestContext = {
    get: (key: string) => values.get(key),
    set: (key: string, value: unknown) => values.set(key, value),
  } as any;
  requestContext.set('controller', {
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
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.MOONSHOT_API_KEY;
    delete process.env.MOONSHOT_AI_API_KEY;
    delete process.env.MASTRA_GATEWAY_API_KEY;
    delete process.env.MASTRA_GATEWAY_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('discovers custom and Copilot providers through the MastraCode gateway', async () => {
    mockLoadSettings.mockReturnValue({
      customProviders: [
        {
          name: 'Acme Models',
          url: 'https://llm.acme.dev/v1',
          apiKey: 'acme-secret',
          models: ['reasoner-v1'],
        } as any,
      ],
      memoryGateway: {},
    });
    mockGetCopilotModelCatalog.mockResolvedValueOnce([{ id: 'gpt-4.1' }] as any);

    const gateway = createMastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway-api.mastra.ai',
      routeThroughMastraGateway: false,
    });

    expect(gateway).toBeInstanceOf(MastraCodeGateway);
    expect(gateway.id).toBe('mastracode');

    await expect(gateway.fetchProviders()).resolves.toMatchObject({
      'acme-models': {
        name: 'Acme Models',
        url: 'https://llm.acme.dev/v1',
        gateway: 'mastracode',
        models: ['reasoner-v1'],
      },
      'github-copilot': {
        name: 'GitHub Copilot',
        gateway: 'mastracode',
        models: ['gpt-4.1'],
      },
    });
    expect(mockGetCopilotModelCatalog).toHaveBeenCalled();
  });

  it('claims models.dev providers authenticated by the injected credential store', () => {
    const gateway = createMastraCodeGateway({
      mastraGatewayBaseUrl: 'https://gateway-api.mastra.ai',
      routeThroughMastraGateway: false,
      credentialStore: {
        allowEnvironmentFallback: false,
        reload() {},
        get: provider =>
          provider === 'alibaba-coding-plan' ? { type: 'api_key', key: 'sk-alibaba-tenant' } : undefined,
        getStoredApiKey: () => undefined,
        getApiKey: async () => undefined,
      },
    });

    expect(gateway.handlesModel('alibaba-coding-plan/glm-5')).toBe(true);
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

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', {
        headers: undefined,
        authStorage: mockAuthStorageInstance,
      });
    });

    it('parses provider/model ids and delegates directly through the MastraCode gateway', () => {
      const resolveAuthSpy = vi.spyOn(MastraCodeGateway.prototype, 'resolveAuth');
      const resolveLanguageModelSpy = vi.spyOn(MastraCodeGateway.prototype, 'resolveLanguageModel');

      try {
        const result = resolveModel('anthropic/claude-sonnet-4-20250514') as Record<string, unknown>;

        expect(result.__provider).toBe('claude-max-oauth');
        expect(resolveAuthSpy).toHaveBeenCalledWith({
          gatewayId: 'mastracode',
          providerId: 'anthropic',
          modelId: 'claude-sonnet-4-20250514',
          routerId: 'mastracode/anthropic/claude-sonnet-4-20250514',
        });
        expect(resolveLanguageModelSpy).toHaveBeenCalledWith({
          providerId: 'anthropic',
          modelId: 'claude-sonnet-4-20250514',
          apiKey: '',
          headers: undefined,
        });
        expect(ModelRouterLanguageModel).not.toHaveBeenCalledWith(
          { id: 'mastracode/anthropic/claude-sonnet-4-20250514', headers: undefined },
          expect.any(Array),
        );
      } finally {
        resolveAuthSpy.mockRestore();
        resolveLanguageModelSpy.mockRestore();
      }
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

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514', {
        headers: undefined,
        authStorage: mockAuthStorageInstance,
      });
    });

    it('passes controller headers to the Anthropic OAuth provider', () => {
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
        authStorage: mockAuthStorageInstance,
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

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-opus-4-6', {
        headers: undefined,
        authStorage: mockAuthStorageInstance,
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

    it('passes OPENAI_BASE_URL to the direct OpenAI API key provider', () => {
      process.env.OPENAI_BASE_URL = 'http://127.0.0.1:4111/v1';
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-openai-key' });

      resolveModel('openai/gpt-4o-mini');

      expect(createOpenAI).toHaveBeenCalledWith({
        apiKey: 'sk-openai-key',
        baseURL: 'http://127.0.0.1:4111/v1',
        headers: undefined,
      });
    });

    it('uses model router when no OpenAI auth is configured', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      const result = resolveModel('openai/gpt-4o') as Record<string, unknown>;
      expect(result.__provider).toBe('model-router');
    });

    it('passes controller headers to the OpenAI OAuth provider', () => {
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
        authStorage: mockAuthStorageInstance,
      });
    });

    it('remaps OpenAI GPT-5 models for Codex OAuth in dynamic model resolution', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'openai-oauth-access-token',
        refresh: 'openai-oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      const values = new Map<string, unknown>();
      const requestContext = {
        get: (key: string) => values.get(key),
        set: (key: string, value: unknown) => values.set(key, value),
      } as any;
      requestContext.set('controller', {
        session: { modelId: 'openai/gpt-5.2' },
        state: {
          thinkingLevel: 'high',
        },
      });

      getDynamicModel({ requestContext });

      expect(openaiCodexProvider).toHaveBeenCalledWith('gpt-5.2-codex', {
        thinkingLevel: 'high',
        headers: undefined,
        authStorage: mockAuthStorageInstance,
      });
    });
  });

  describe('moonshotai/* models', () => {
    it('uses a stored moonshot API key with the Anthropic-compatible endpoint', () => {
      mockAuthStorageInstance.getStoredApiKey.mockImplementation((provider: string) =>
        provider === 'moonshotai' ? 'sk-moonshot-stored' : undefined,
      );

      const result = resolveModel('moonshotai/kimi-k2.6') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.modelId).toBe('kimi-k2.6');
      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'sk-moonshot-stored',
        baseURL: 'https://api.moonshot.ai/anthropic/v1',
        name: 'moonshotai.anthropicv1',
        headers: undefined,
      });
    });

    it('falls back to MOONSHOT_API_KEY when no stored credential exists', () => {
      process.env.MOONSHOT_API_KEY = 'sk-moonshot-env';
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);

      const result = resolveModel('moonshotai/kimi-k2.6') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.modelId).toBe('kimi-k2.6');
      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'sk-moonshot-env',
        baseURL: 'https://api.moonshot.ai/anthropic/v1',
        name: 'moonshotai.anthropicv1',
        headers: undefined,
      });
    });

    it('falls back to legacy MOONSHOT_AI_API_KEY for compatibility', () => {
      process.env.MOONSHOT_AI_API_KEY = 'sk-moonshot-legacy';
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);

      const result = resolveModel('moonshotai/kimi-k2.6') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(createAnthropic).toHaveBeenCalledWith({
        apiKey: 'sk-moonshot-legacy',
        baseURL: 'https://api.moonshot.ai/anthropic/v1',
        name: 'moonshotai.anthropicv1',
        headers: undefined,
      });
    });

    it('throws Need MOONSHOT_API_KEY when no key is available', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);

      expect(() => resolveModel('moonshotai/kimi-k2.6')).toThrow(/Need MOONSHOT_API_KEY/);
    });
  });

  describe('other providers', () => {
    it('uses model router for unknown providers', () => {
      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;
      expect(result.__provider).toBe('model-router');
    });

    it('passes stored API keys to model router providers', () => {
      mockAuthStorageInstance.get.mockImplementation((provider: string) =>
        provider === 'alibaba-coding-plan' ? { type: 'api_key', key: 'sk-alibaba-stored' } : undefined,
      );

      const result = resolveModel('alibaba-coding-plan/glm-5') as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.apiKey).toBe('sk-alibaba-stored');
    });

    it('resolves gateway auth through the MastraCode gateway hook', () => {
      const auth = resolveAuth(
        {
          gatewayId: 'mastra',
          providerId: 'anthropic',
          modelId: 'claude-sonnet-4',
          routerId: 'mastra/anthropic/claude-sonnet-4',
        },
        'msk_gateway_key_123',
      );

      expect(auth).toEqual({ apiKey: 'msk_gateway_key_123', source: 'gateway' });
    });

    it('passes controller headers to model router providers', () => {
      const result = resolveModel('google/gemini-2.0-flash', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      }) as Record<string, unknown>;

      expect(result.__provider).toBe('model-router');
      expect(result.headers).toEqual({
        'x-thread-id': 'thread-123',
        'x-resource-id': 'resource-456',
      });
    });

    it('passes controller headers to custom providers', () => {
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

      expect(result.__provider).toBe('custom-openai-compatible');
      expect(result.modelId).toBe('reasoner-v1');
      expect(result.url).toBe('https://llm.acme.dev/v1');
      expect(result.apiKey).toBe('acme-secret');
      expect(result.headers).toEqual({
        'x-thread-id': 'thread-123',
        'x-resource-id': 'resource-456',
      });
    });
  });

  describe('amazon-bedrock/* models', () => {
    it('resolves Bedrock models through the AWS SDK with the credential chain', () => {
      process.env.AWS_REGION = 'us-west-2';

      const result = resolveModel(MODEL_TOKENS.__GATEWAY_BEDROCK_MODEL_OPUS__) as Record<string, unknown>;

      expect(result.__provider).toBe('amazon-bedrock');
      expect(result.modelId).toBe(MODEL_TOKENS.__BEDROCK_MODEL_OPUS_BARE__);
      expect(result.region).toBe('us-west-2');
      expect(result.credentialProvider).toBe(mockCredentialProvider);
      expect(fromNodeProviderChain).toHaveBeenCalled();
      expect(createAmazonBedrock).toHaveBeenCalled();
    });

    it('falls back to us-east-1 when no AWS region is configured', () => {
      delete process.env.AWS_REGION;
      delete process.env.AWS_DEFAULT_REGION;

      const result = resolveModel(MODEL_TOKENS.__GATEWAY_BEDROCK_MODEL_OPUS__) as Record<string, unknown>;

      expect(result.region).toBe('us-east-1');
    });

    it('preserves a colon-bearing Bedrock model id', () => {
      const result = resolveModel(MODEL_TOKENS.__GATEWAY_BEDROCK_MODEL_SONNET__) as Record<string, unknown>;

      expect(result.__provider).toBe('amazon-bedrock');
      expect(result.modelId).toBe(MODEL_TOKENS.__BEDROCK_MODEL_SONNET_BARE__);
    });

    it('passes harness headers to the Bedrock provider', () => {
      const result = resolveModel(MODEL_TOKENS.__GATEWAY_BEDROCK_MODEL_OPUS__, {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      }) as Record<string, unknown>;

      expect(result.headers).toEqual({
        'x-thread-id': 'thread-123',
        'x-resource-id': 'resource-456',
      });
    });
  });

  describe('mastra gateway enabled (gateway API key stored)', () => {
    beforeEach(() => {
      mockAuthStorageInstance.getStoredApiKey.mockImplementation((providerId: string) =>
        providerId === 'mastra-gateway' ? 'msk_gateway_key_123' : undefined,
      );
    });

    it('routes explicit mastra-prefixed anthropic model through gateway', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('mastra-gateway-delegate');
      expect(result.args).toEqual({
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4',
        apiKey: 'msk_gateway_key_123',
        headers: undefined,
      });
      expect(MastraGateway).toHaveBeenCalledWith({
        baseUrl: 'https://gateway-api.mastra.ai',
      });
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();
    });

    it('routes explicit mastra-prefixed anthropic OAuth model through custom gateway middleware', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'oauth-access-token',
        refresh: 'oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('anthropic-direct');
      expect(result.__wrapped).toBe(true);
      expect(MastraGateway).toHaveBeenCalledWith({ baseUrl: 'https://gateway-api.mastra.ai' });
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();

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
      expect(wrapLanguageModel).toHaveBeenCalled();
      expect(result.__wrapped).toBe(true);
      expect(result.__provider).toBe('anthropic-direct');
      expect(result.modelId).toBe('claude-sonnet-4');
      expect(opencodeClaudeMaxProvider).not.toHaveBeenCalled();
    });

    it('normalizes mastra-prefixed anthropic OAuth model ids inside the custom gateway', () => {
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
    });

    it('routes explicit mastra-prefixed openai OAuth model through custom gateway Codex middleware', () => {
      mockAuthStorageInstance.get.mockReturnValue({
        type: 'oauth',
        access: 'openai-oauth-access-token',
        refresh: 'openai-oauth-refresh-token',
        expires: Date.now() + 60_000,
      });

      const result = resolveModel('mastra/openai/gpt-4o') as Record<string, unknown>;

      expect(result.__provider).toBe('openai-direct');
      expect(result.__wrapped).toBe(true);
      expect(MastraGateway).toHaveBeenCalledWith({ baseUrl: 'https://gateway-api.mastra.ai' });
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();

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
        authStorage: mockAuthStorageInstance,
        rewriteUrl: false,
      });
      expect(wrapLanguageModel).toHaveBeenCalled();
      expect(result.__wrapped).toBe(true);
      expect(result.__provider).toBe('openai-direct');
      expect(result.modelId).toBe('gpt-4o');
      expect(openaiCodexProvider).not.toHaveBeenCalled();
    });

    it('routes explicit mastra-prefixed anthropic API key model through gateway without customFetch', () => {
      mockAuthStorageInstance.get.mockReturnValue({ type: 'api_key', key: 'sk-stored-key' });

      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('mastra-gateway-delegate');
      expect(result.args).toEqual({
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4',
        apiKey: 'msk_gateway_key_123',
        headers: undefined,
      });
      expect(MastraGateway).toHaveBeenCalledWith({
        baseUrl: 'https://gateway-api.mastra.ai',
      });
      expect(buildAnthropicOAuthFetch).not.toHaveBeenCalled();
    });

    it('routes explicit mastra-prefixed unknown provider through gateway fallback', () => {
      const result = resolveModel('mastra/google/gemini-2.0-flash') as Record<string, unknown>;

      expect(result.__provider).toBe('mastra-gateway-delegate');
      expect(result.args).toEqual({
        providerId: 'google',
        modelId: 'gemini-2.0-flash',
        apiKey: 'msk_gateway_key_123',
        headers: undefined,
      });
      expect(MastraGateway).toHaveBeenCalledWith({
        baseUrl: 'https://gateway-api.mastra.ai',
      });
    });

    it('custom provider bypasses gateway', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [{ name: 'Acme', url: 'https://llm.acme.dev/v1', apiKey: 'acme-secret' }],
        memoryGateway: {},
      });

      const result = resolveModel('acme/reasoner-v1') as Record<string, unknown>;

      expect(result.__provider).toBe('custom-openai-compatible');
      expect(result.modelId).toBe('reasoner-v1');
      expect(result.url).toBe('https://llm.acme.dev/v1');
      expect(MastraGateway).toHaveBeenCalledWith({ baseUrl: 'https://gateway-api.mastra.ai' });
    });

    it('passes baseUrl when explicitly set in settings for explicit mastra-prefixed models', () => {
      mockLoadSettings.mockReturnValue({
        customProviders: [],
        memoryGateway: { baseUrl: 'https://custom-gateway.example.com' },
      });
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      resolveModel('mastra/anthropic/claude-sonnet-4');

      expect(MastraGateway).toHaveBeenCalledWith({
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
        baseUrl: 'https://gateway-api.mastra.ai',
      });
    });

    it('passes controller headers to the gateway-resolved model', () => {
      mockAuthStorageInstance.get.mockReturnValue(undefined);

      const result = resolveModel('mastra/anthropic/claude-sonnet-4', {
        requestContext: makeRequestContext({ threadId: 'thread-123', resourceId: 'resource-456' }),
      }) as Record<string, unknown>;

      expect((result.args as Record<string, unknown>).headers).toEqual({
        'x-thread-id': 'thread-123',
        'x-resource-id': 'resource-456',
      });
      expect(ModelRouterLanguageModel).not.toHaveBeenCalled();
    });

    it('skips gateway when no API key is stored and no env var', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      delete process.env['MASTRA_GATEWAY_API_KEY'];

      resolveModel('anthropic/claude-sonnet-4');

      expect(MastraGateway).toHaveBeenCalledWith({ baseUrl: 'https://gateway-api.mastra.ai' });
      // Falls through through the MastraCode gateway to normal provider logic.
      expect(opencodeClaudeMaxProvider).toHaveBeenCalled();
    });

    it('does not route plain provider/model ids through the gateway just because MASTRA_GATEWAY_API_KEY is set', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      process.env['MASTRA_GATEWAY_API_KEY'] = 'msk_env_key';

      resolveModel('anthropic/claude-sonnet-4');

      expect(MastraGateway).toHaveBeenCalledWith({ baseUrl: 'https://gateway-api.mastra.ai' });
      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4', {
        headers: undefined,
        authStorage: mockAuthStorageInstance,
      });
      delete process.env['MASTRA_GATEWAY_API_KEY'];
    });

    it('routes explicit mastra-prefixed ids through the gateway when MASTRA_GATEWAY_API_KEY is set', () => {
      mockAuthStorageInstance.getStoredApiKey.mockReturnValue(undefined);
      mockAuthStorageInstance.get.mockReturnValue(undefined);
      process.env['MASTRA_GATEWAY_API_KEY'] = 'msk_env_key';

      const result = resolveModel('mastra/anthropic/claude-sonnet-4') as Record<string, unknown>;

      expect(result.__provider).toBe('mastra-gateway-delegate');
      expect(result.args).toEqual({
        providerId: 'anthropic',
        modelId: 'claude-sonnet-4',
        apiKey: 'msk_env_key',
        headers: undefined,
      });
      expect(MastraGateway).toHaveBeenCalledWith({ baseUrl: 'https://gateway-api.mastra.ai' });
      delete process.env['MASTRA_GATEWAY_API_KEY'];
    });
  });
});

function makeTenantCredentialStore() {
  return {
    allowEnvironmentFallback: false,
    reload: vi.fn(),
    get: vi.fn(() => undefined),
    getStoredApiKey: vi.fn(() => undefined),
    getApiKey: vi.fn(async () => undefined),
  };
}

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

  it('ignores the env var when the credential store disables environment fallback', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-env-key';
    expect(getAnthropicApiKey(makeTenantCredentialStore())).toBeUndefined();
  });
});

describe('getOpenAIApiKey', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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

  it('falls back to env var in local mode', () => {
    process.env.OPENAI_API_KEY = 'sk-env-key';
    mockAuthStorageInstance.get.mockReturnValue(undefined);
    expect(getOpenAIApiKey()).toBe('sk-env-key');
  });

  it('ignores the env var when the credential store disables environment fallback', () => {
    process.env.OPENAI_API_KEY = 'sk-env-key';
    expect(getOpenAIApiKey(makeTenantCredentialStore())).toBeUndefined();
  });
});
