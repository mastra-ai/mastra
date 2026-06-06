import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createOpenAIMock, responsesMock } = vi.hoisted(() => ({
  createOpenAIMock: vi.fn(),
  responsesMock: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: createOpenAIMock,
}));

vi.mock('ai', () => ({
  wrapLanguageModel: vi.fn(({ model, middleware }) => ({ model, middleware })),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const openAIStorage = {
  reload: vi.fn(),
  get: vi.fn(),
  getApiKey: vi.fn(),
};

describe('OpenAI Codex OAuth fetch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    createOpenAIMock.mockReset();
    responsesMock.mockReset();
    responsesMock.mockReturnValue({ provider: 'openai' });
    createOpenAIMock.mockReturnValue({ responses: responsesMock });
    openAIStorage.reload.mockReset();
    openAIStorage.get.mockReset();
    openAIStorage.getApiKey.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('injects Codex OAuth runtime headers', async () => {
    openAIStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'oauth-token',
      expires: Date.now() + 60_000,
      accountId: 'acct-123',
    });
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const { buildOpenAICodexOAuthFetch } = await import('../openai-codex.js');
    const fetchWithOAuth = buildOpenAICodexOAuthFetch({ authStorage: openAIStorage as any });

    await fetchWithOAuth('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toBe('https://chatgpt.com/backend-api/codex/responses');
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer oauth-token');
    expect(headers.get('ChatGPT-Account-ID')).toBe('acct-123');
    expect(headers.get('originator')).toBe('mastracode');
    expect(headers.get('User-Agent')).toBe('mastracode');
  });

  it('passes OPENAI_BASE_URL to the Codex provider model factory', async () => {
    vi.stubEnv('OPENAI_BASE_URL', 'http://127.0.0.1:4111/v1');

    const { openaiCodexProvider } = await import('../openai-codex.js');
    openaiCodexProvider('gpt-5-codex-mini');

    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      baseURL: 'http://127.0.0.1:4111/v1',
      headers: undefined,
    });
    expect(responsesMock).toHaveBeenCalledWith('gpt-5-codex-mini');
  });
});
