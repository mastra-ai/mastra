import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Clear the module registry so vi.mock factories take effect even when
// a previous test file (running under isolate:false) already cached the real modules.
vi.hoisted(() => vi.resetModules());

// Use vi.hoisted so the mock instance is available when vi.mock factory runs (hoisted above imports)
const mockAuthStorageInstance = vi.hoisted(() => ({
  reload: vi.fn(),
  get: vi.fn(),
  isLoggedIn: vi.fn().mockReturnValue(false),
}));

vi.mock('../../auth/storage.js', () => {
  return {
    AuthStorage: class MockAuthStorage {
      reload = mockAuthStorageInstance.reload;
      get = mockAuthStorageInstance.get;
      isLoggedIn = mockAuthStorageInstance.isLoggedIn;
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

// Mock ModelRouterLanguageModel
vi.mock('@mastra/core/llm', () => ({
  ModelRouterLanguageModel: vi.fn(function (this: Record<string, unknown>, modelId: string) {
    this.__provider = 'model-router';
    this.modelId = modelId;
  }),
}));

import { opencodeClaudeMaxProvider } from '../../providers/claude-max.js';
import { openaiCodexProvider } from '../../providers/openai-codex.js';
import { resolveModel, getAnthropicApiKey, getOpenAIApiKey } from '../model.js';

describe('resolveModel', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
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

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514');
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
      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514');
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

      expect(opencodeClaudeMaxProvider).toHaveBeenCalledWith('claude-sonnet-4-20250514');
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
  });

  describe('other providers', () => {
    it('uses model router for unknown providers', () => {
      const result = resolveModel('google/gemini-2.0-flash') as Record<string, unknown>;
      expect(result.__provider).toBe('model-router');
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
