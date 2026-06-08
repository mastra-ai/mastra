import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    openAIStorage.reload.mockReset();
    openAIStorage.get.mockReset();
    openAIStorage.getApiKey.mockReset();
  });

  afterEach(() => {
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
});
