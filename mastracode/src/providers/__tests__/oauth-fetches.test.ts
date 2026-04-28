import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const anthropicStorage = {
  reload: vi.fn(),
  get: vi.fn(),
  getApiKey: vi.fn(),
};

const openAIStorage = {
  reload: vi.fn(),
  get: vi.fn(),
  getApiKey: vi.fn(),
};

describe('gateway oauth fetch wrappers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    anthropicStorage.reload.mockReset();
    anthropicStorage.get.mockReset();
    anthropicStorage.getApiKey.mockReset();
    openAIStorage.reload.mockReset();
    openAIStorage.get.mockReset();
    openAIStorage.getApiKey.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('annotates Anthropic gateway fetch errors with the request URL', async () => {
    anthropicStorage.get.mockReturnValue({ type: 'oauth' });
    anthropicStorage.getApiKey.mockResolvedValue('oauth-token');
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    const { buildAnthropicOAuthFetch } = await import('../claude-max.js');
    const fetchWithOAuth = buildAnthropicOAuthFetch({ authStorage: anthropicStorage as any });

    await expect(fetchWithOAuth('https://server.mastra.ai/v1/messages', { headers: {} })).rejects.toMatchObject({
      requestUrl: 'https://server.mastra.ai/v1/messages',
    });
  });

  it('annotates OpenAI gateway fetch errors with the request URL', async () => {
    openAIStorage.get.mockReturnValue({ type: 'oauth', access: 'oauth-token', expires: Date.now() + 60_000 });
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    const { buildOpenAICodexOAuthFetch } = await import('../openai-codex.js');
    const fetchWithOAuth = buildOpenAICodexOAuthFetch({ authStorage: openAIStorage as any, rewriteUrl: false });

    await expect(fetchWithOAuth('https://server.mastra.ai/v1/responses', { headers: {} })).rejects.toMatchObject({
      requestUrl: 'https://server.mastra.ai/v1/responses',
    });
  });
});
