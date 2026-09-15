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

const githubCopilotStorage = {
  reload: vi.fn(),
  get: vi.fn(),
  getApiKey: vi.fn(),
};

const xaiStorage = {
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
    githubCopilotStorage.reload.mockReset();
    githubCopilotStorage.get.mockReset();
    githubCopilotStorage.getApiKey.mockReset();
    xaiStorage.reload.mockReset();
    xaiStorage.get.mockReset();
    xaiStorage.getApiKey.mockReset();
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

  it('merges SDK-provided anthropic-beta values with the OAuth-required betas', async () => {
    anthropicStorage.get.mockReturnValue({ type: 'oauth' });
    anthropicStorage.getApiKey.mockResolvedValue('oauth-token');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const { buildAnthropicOAuthFetch } = await import('../claude-max.js');
    const fetchWithOAuth = buildAnthropicOAuthFetch({ authStorage: anthropicStorage as any });

    // The AI SDK sets this beta when providerOptions.anthropic.fallbacks is
    // configured; overwriting it makes the API reject the `fallbacks` body
    // field with "Extra inputs are not permitted".
    await fetchWithOAuth('https://api.anthropic.com/v1/messages', {
      headers: { 'anthropic-beta': 'server-side-fallback-2026-06-01' },
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    const betas = headers.get('anthropic-beta')!.split(',');
    expect(betas).toContain('server-side-fallback-2026-06-01');
    expect(betas).toContain('oauth-2025-04-20');
    expect(betas).toContain('claude-code-20250219');
    // No duplicates when a required beta is also present on the request.
    expect(new Set(betas).size).toBe(betas.length);
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

  it('rewrites GitHub Copilot requests to the proxy-ep host and injects Copilot headers', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const { buildGitHubCopilotOAuthFetch } = await import('../github-copilot.js');
    const fetchWithOAuth = buildGitHubCopilotOAuthFetch({ authStorage: githubCopilotStorage as any });

    await fetchWithOAuth('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    // URL should be rewritten to the api host implied by proxy-ep, and the `/v1`
    // prefix that @ai-sdk/openai adds must be stripped — Copilot's endpoints live
    // at `/chat/completions` etc., not `/v1/chat/completions`.
    expect(calledUrl.toString()).toBe('https://api.individual.githubcopilot.com/chat/completions');
    const headers = calledInit?.headers as Headers;
    expect(headers.get('Authorization')).toMatch(/^Bearer /);
    expect(headers.get('Editor-Version')).toBeTruthy();
    expect(headers.get('Copilot-Integration-Id')).toBe('vscode-chat');
    // Last message has role=user and no tool_result parts → user-initiated.
    expect(headers.get('x-initiator')).toBe('user');
  });

  it('marks tool-result follow-ups as agent-initiated for billing', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const { buildGitHubCopilotOAuthFetch } = await import('../github-copilot.js');
    const fetchWithOAuth = buildGitHubCopilotOAuthFetch({ authStorage: githubCopilotStorage as any });

    await fetchWithOAuth('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'run a tool' },
          { role: 'assistant', content: '...' },
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
          },
        ],
      }),
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('x-initiator')).toBe('agent');
  });

  it('annotates GitHub Copilot fetch errors with the rewritten request URL', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    const { buildGitHubCopilotOAuthFetch } = await import('../github-copilot.js');
    const fetchWithOAuth = buildGitHubCopilotOAuthFetch({ authStorage: githubCopilotStorage as any });

    await expect(fetchWithOAuth('https://api.openai.com/v1/chat/completions', { headers: {} })).rejects.toMatchObject({
      requestUrl: 'https://api.individual.githubcopilot.com/chat/completions',
    });
  });

  it('strips the `/v1` prefix from the request path for non-completions endpoints too', async () => {
    githubCopilotStorage.get.mockReturnValue({
      type: 'oauth',
      access: 'tid=test;proxy-ep=proxy.individual.githubcopilot.com;',
      refresh: 'ghu_x',
      expires: Date.now() + 60_000,
    });
    githubCopilotStorage.getApiKey.mockResolvedValue('tid=test;proxy-ep=proxy.individual.githubcopilot.com;');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));

    const { buildGitHubCopilotOAuthFetch } = await import('../github-copilot.js');
    const fetchWithOAuth = buildGitHubCopilotOAuthFetch({ authStorage: githubCopilotStorage as any });

    await fetchWithOAuth('https://api.openai.com/v1/responses', { headers: {} });
    expect(fetchMock.mock.calls[0]![0].toString()).toBe('https://api.individual.githubcopilot.com/responses');

    fetchMock.mockClear();
    // Paths that don't start with `/v1` should be left alone.
    await fetchWithOAuth('https://api.openai.com/chat/completions', { headers: {} });
    expect(fetchMock.mock.calls[0]![0].toString()).toBe('https://api.individual.githubcopilot.com/chat/completions');
  });

  it('throws a friendly error when the user is not logged in to GitHub Copilot', async () => {
    githubCopilotStorage.get.mockReturnValue(undefined);

    const { buildGitHubCopilotOAuthFetch } = await import('../github-copilot.js');
    const fetchWithOAuth = buildGitHubCopilotOAuthFetch({ authStorage: githubCopilotStorage as any });

    await expect(fetchWithOAuth('https://api.openai.com/v1/chat/completions', { headers: {} })).rejects.toThrow(
      /Not logged in to GitHub Copilot/,
    );
  });

  it('injects the refreshed xAI access token as a bearer and strips caller auth headers', async () => {
    xaiStorage.get.mockReturnValue({ type: 'oauth', access: 'stale', expires: Date.now() + 60_000 });
    xaiStorage.getApiKey.mockResolvedValue('xai-oauth-token');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const { buildXAIOAuthFetch } = await import('../xai.js');
    const fetchWithOAuth = buildXAIOAuthFetch({ authStorage: xaiStorage as any });

    await fetchWithOAuth('https://api.x.ai/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer caller-key', 'x-api-key': 'caller-key' },
    });

    expect(xaiStorage.reload).toHaveBeenCalled();
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer xai-oauth-token');
    expect(headers.get('x-api-key')).toBeNull();
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('preserves non-auth headers from an incoming Request', async () => {
    xaiStorage.get.mockReturnValue({ type: 'oauth', access: 'stale', expires: Date.now() + 60_000 });
    xaiStorage.getApiKey.mockResolvedValue('xai-oauth-token');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const { buildXAIOAuthFetch } = await import('../xai.js');
    const fetchWithOAuth = buildXAIOAuthFetch({ authStorage: xaiStorage as any });
    const request = new Request('https://api.x.ai/v1/chat/completions', {
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-1', Authorization: 'Bearer caller-key' },
    });

    await fetchWithOAuth(request);

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer xai-oauth-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Request-ID')).toBe('request-1');
  });

  it('annotates xAI fetch errors with the request URL', async () => {
    xaiStorage.get.mockReturnValue({ type: 'oauth', access: 'token', expires: Date.now() + 60_000 });
    xaiStorage.getApiKey.mockResolvedValue('xai-oauth-token');
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    const { buildXAIOAuthFetch } = await import('../xai.js');
    const fetchWithOAuth = buildXAIOAuthFetch({ authStorage: xaiStorage as any });

    await expect(fetchWithOAuth('https://api.x.ai/v1/chat/completions', { headers: {} })).rejects.toMatchObject({
      requestUrl: 'https://api.x.ai/v1/chat/completions',
    });
  });

  it('throws a friendly error when the user is not logged in to xAI', async () => {
    xaiStorage.get.mockReturnValue(undefined);

    const { buildXAIOAuthFetch } = await import('../xai.js');
    const fetchWithOAuth = buildXAIOAuthFetch({ authStorage: xaiStorage as any });

    await expect(fetchWithOAuth('https://api.x.ai/v1/chat/completions', { headers: {} })).rejects.toThrow(
      /Not logged in to xAI/,
    );
  });
});
