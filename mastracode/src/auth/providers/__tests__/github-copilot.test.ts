import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COPILOT_HEADERS,
  fetchCopilotModels,
  getGitHubCopilotBaseUrl,
  githubCopilotOAuthProvider,
  loginGitHubCopilot,
  normalizeDomain,
  refreshGitHubCopilotToken,
} from '../github-copilot.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  throw new Error(`Unsupported fetch input: ${String(input)}`);
}

describe('normalizeDomain', () => {
  it('returns null for empty input', () => {
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('   ')).toBeNull();
  });

  it('parses bare hostnames', () => {
    expect(normalizeDomain('company.ghe.com')).toBe('company.ghe.com');
  });

  it('parses fully-qualified URLs', () => {
    expect(normalizeDomain('https://company.ghe.com/login')).toBe('company.ghe.com');
  });

  it('returns null for unparseable input', () => {
    expect(normalizeDomain('::')).toBeNull();
  });
});

describe('getGitHubCopilotBaseUrl', () => {
  it('falls back to the public Copilot API when no token is provided', () => {
    expect(getGitHubCopilotBaseUrl()).toBe('https://api.individual.githubcopilot.com');
  });

  it('uses the Copilot enterprise host when an enterprise domain is provided', () => {
    expect(getGitHubCopilotBaseUrl(undefined, 'company.ghe.com')).toBe('https://copilot-api.company.ghe.com');
  });

  it('parses proxy-ep from the bearer token and rewrites it to the api host', () => {
    const token = 'tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;';
    expect(getGitHubCopilotBaseUrl(token)).toBe('https://api.individual.githubcopilot.com');
  });

  it('prefers proxy-ep over the enterprise fallback', () => {
    const token = 'tid=test;proxy-ep=proxy.business.githubcopilot.com;';
    expect(getGitHubCopilotBaseUrl(token, 'company.ghe.com')).toBe('https://api.business.githubcopilot.com');
  });
});

describe('refreshGitHubCopilotToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges a GitHub OAuth token for a Copilot bearer token with a 5-minute safety buffer', async () => {
    const expiresAtSeconds = 1_700_000_000;
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      expect(getUrl(input)).toBe('https://api.github.com/copilot_internal/v2/token');
      expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBe('Bearer ghu_test_token');
      // Verify all VS Code-like headers are present so Copilot accepts the request.
      for (const [key, value] of Object.entries(COPILOT_HEADERS)) {
        expect((init?.headers as Record<string, string>)[key]).toBe(value);
      }
      return jsonResponse({ token: 'copilot-bearer', expires_at: expiresAtSeconds });
    });
    vi.stubGlobal('fetch', fetchMock);

    const credentials = await refreshGitHubCopilotToken('ghu_test_token');

    expect(credentials).toEqual({
      refresh: 'ghu_test_token',
      access: 'copilot-bearer',
      expires: expiresAtSeconds * 1000 - 5 * 60 * 1000,
    });
  });

  it('routes refreshes through the enterprise host when an enterprise domain is provided', async () => {
    const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
      expect(getUrl(input)).toBe('https://api.company.ghe.com/copilot_internal/v2/token');
      return jsonResponse({ token: 'copilot-bearer', expires_at: 9999999999 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const credentials = await refreshGitHubCopilotToken('ghu_test_token', 'company.ghe.com');
    expect(credentials.enterpriseUrl).toBe('company.ghe.com');
  });

  it('throws when the response is missing required fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ token: 'copilot-bearer' })),
    );
    await expect(refreshGitHubCopilotToken('ghu_test_token')).rejects.toThrow(/Invalid Copilot token response/);
  });
});

describe('GitHub Copilot OAuth device flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('completes the device flow and returns Copilot credentials', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T00:00:00Z'));

    const accessTokenResponses = [
      jsonResponse({ error: 'authorization_pending', error_description: 'pending' }),
      jsonResponse({ access_token: 'ghu_user_token' }),
    ];

    const onAuth = vi.fn();
    const onProgress = vi.fn();

    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      const url = getUrl(input);

      if (url.endsWith('/login/device/code')) {
        expect(init?.method).toBe('POST');
        expect(String(init?.body)).toContain('client_id=');
        expect(String(init?.body)).toContain('scope=read%3Auser');
        return jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        });
      }

      if (url.endsWith('/login/oauth/access_token')) {
        expect(String(init?.body)).toContain('device_code=device-code');
        expect(String(init?.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code');
        const response = accessTokenResponses.shift();
        if (!response) throw new Error('Unexpected extra access token poll');
        return response;
      }

      if (url.endsWith('/copilot_internal/v2/token')) {
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer ghu_user_token');
        return jsonResponse({
          token: 'tid=test;exp=9999999999;proxy-ep=proxy.individual.githubcopilot.com;',
          expires_at: 9999999999,
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const loginPromise = loginGitHubCopilot({
      onAuth,
      onPrompt: async () => '',
      onProgress,
    });

    // Drive the timers forward enough to satisfy two polls (~12s apart).
    await vi.advanceTimersByTimeAsync(20_000);
    const credentials = await loginPromise;

    expect(credentials.access).toContain('proxy-ep=');
    expect(credentials.refresh).toBe('ghu_user_token');
    expect(onAuth).toHaveBeenCalledWith('https://github.com/login/device', 'Enter code: ABCD-EFGH');
    expect(onProgress).toHaveBeenCalledWith('Fetching Copilot token...');
  });

  it('waits before the first poll and increases the safety margin after slow_down', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-03-09T00:00:00Z');
    vi.setSystemTime(startTime);

    const accessTokenPollTimes: number[] = [];
    const accessTokenResponses = [
      jsonResponse({ error: 'authorization_pending', error_description: 'pending' }),
      jsonResponse({ error: 'slow_down', error_description: 'slow down', interval: 10 }),
      jsonResponse({ access_token: 'ghu_user_token' }),
    ];

    const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
      const url = getUrl(input);

      if (url.endsWith('/login/device/code')) {
        return jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        });
      }

      if (url.endsWith('/login/oauth/access_token')) {
        accessTokenPollTimes.push(Date.now());
        const response = accessTokenResponses.shift();
        if (!response) throw new Error('Unexpected extra access token poll');
        return response;
      }

      if (url.endsWith('/copilot_internal/v2/token')) {
        return jsonResponse({ token: 'copilot-bearer', expires_at: 9999999999 });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const loginPromise = loginGitHubCopilot({ onAuth: () => {}, onPrompt: async () => '' });

    // Initial poll fires after interval(5s) * 1.2 = 6s.
    await vi.advanceTimersByTimeAsync(5999);
    expect(accessTokenPollTimes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(accessTokenPollTimes).toHaveLength(1);

    // Second poll fires another 6s later (still 1.2x multiplier — not slowed yet).
    await vi.advanceTimersByTimeAsync(5999);
    expect(accessTokenPollTimes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(accessTokenPollTimes).toHaveLength(2);

    // After slow_down (interval=10), next wait is 10s * 1.4 = 14s.
    await vi.advanceTimersByTimeAsync(13999);
    expect(accessTokenPollTimes).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(accessTokenPollTimes).toHaveLength(3);

    await loginPromise;

    expect(accessTokenPollTimes).toEqual([
      startTime.getTime() + 6000,
      startTime.getTime() + 12000,
      startTime.getTime() + 26000,
    ]);
  });

  it('reports a clock-drift hint when timing out after repeated slow_down responses', async () => {
    vi.useFakeTimers();
    const startTime = new Date('2026-03-09T00:00:00Z');
    vi.setSystemTime(startTime);

    const accessTokenResponses = [
      jsonResponse({ error: 'slow_down', error_description: 'slow down', interval: 10 }),
      jsonResponse({ error: 'slow_down', error_description: 'still too fast', interval: 15 }),
      jsonResponse({ error: 'authorization_pending', error_description: 'pending' }),
    ];

    const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
      const url = getUrl(input);
      if (url.endsWith('/login/device/code')) {
        return jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 25,
        });
      }
      if (url.endsWith('/login/oauth/access_token')) {
        const response = accessTokenResponses.shift();
        if (!response) throw new Error('Unexpected extra access token poll');
        return response;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const loginPromise = loginGitHubCopilot({ onAuth: () => {}, onPrompt: async () => '' });
    const rejection = expect(loginPromise).rejects.toThrow(/Device flow timed out after one or more slow_down/);

    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
  });

  it('throws on access_denied without retrying', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
      const url = getUrl(input);
      if (url.endsWith('/login/device/code')) {
        return jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        });
      }
      if (url.endsWith('/login/oauth/access_token')) {
        return jsonResponse({ error: 'access_denied', error_description: 'user declined' });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const loginPromise = loginGitHubCopilot({ onAuth: () => {}, onPrompt: async () => '' });
    const rejection = expect(loginPromise).rejects.toThrow(/Device flow failed: access_denied/);
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
  });

  it('rejects an invalid GitHub Enterprise URL/domain', async () => {
    const loginPromise = loginGitHubCopilot({
      onAuth: () => {},
      onPrompt: async () => '::',
    });
    await expect(loginPromise).rejects.toThrow(/Invalid GitHub Enterprise URL\/domain/);
  });

  it('passes the AbortSignal into the underlying fetch calls', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T00:00:00Z'));

    const seenSignals: (AbortSignal | undefined)[] = [];
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      seenSignals.push(init?.signal ?? undefined);
      const url = getUrl(input);

      if (url.endsWith('/login/device/code')) {
        return jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        });
      }
      if (url.endsWith('/login/oauth/access_token')) {
        return jsonResponse({ access_token: 'ghu_user_token' });
      }
      if (url.endsWith('/copilot_internal/v2/token')) {
        return jsonResponse({ token: 'copilot-bearer', expires_at: 9999999999 });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    const loginPromise = loginGitHubCopilot({
      onAuth: () => {},
      onPrompt: async () => '',
      signal: controller.signal,
    });

    await vi.advanceTimersByTimeAsync(20_000);
    await loginPromise;

    // Device code, access token, and copilot token requests should all carry the signal.
    expect(seenSignals.length).toBeGreaterThanOrEqual(3);
    for (const signal of seenSignals) {
      expect(signal).toBe(controller.signal);
    }
  });

  it('honors AbortSignal cancellation between polls', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();

    const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
      const url = getUrl(input);
      if (url.endsWith('/login/device/code')) {
        return jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const loginPromise = loginGitHubCopilot({
      onAuth: () => {},
      onPrompt: async () => '',
      signal: controller.signal,
    });
    const rejection = expect(loginPromise).rejects.toThrow(/Login cancelled/);

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejection;
  });
});

describe('fetchCopilotModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function modelEntry(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      vendor: 'Anthropic',
      model_picker_enabled: true,
      capabilities: {
        family: 'claude',
        limits: { max_context_window_tokens: 200000, max_prompt_tokens: 90000, max_output_tokens: 16384 },
        supports: { streaming: true, tool_calls: true, vision: true },
      },
      ...overrides,
    };
  }

  it('hits ${baseUrl}/models with the bearer token and Copilot headers', async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
      expect(getUrl(input)).toBe('https://api.individual.githubcopilot.com/models');
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer copilot-bearer');
      // Copilot expects the same VS Code-like headers as chat completions.
      for (const [key, value] of Object.entries(COPILOT_HEADERS)) {
        expect(headers[key]).toBe(value);
      }
      return jsonResponse({ data: [modelEntry({})] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const models = await fetchCopilotModels({
      baseUrl: 'https://api.individual.githubcopilot.com',
      bearerToken: 'copilot-bearer',
    });

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: 'claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      vendor: 'Anthropic',
      supportsVision: true,
      supportsToolCalls: true,
    });
  });

  it('strips a trailing slash from the base URL', async () => {
    const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
      expect(getUrl(input)).toBe('https://api.individual.githubcopilot.com/models');
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchCopilotModels({
      baseUrl: 'https://api.individual.githubcopilot.com/',
      bearerToken: 'copilot-bearer',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('filters out entries where model_picker_enabled is not true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [
            modelEntry({ id: 'visible', model_picker_enabled: true }),
            modelEntry({ id: 'hidden-false', model_picker_enabled: false }),
            modelEntry({ id: 'hidden-missing', model_picker_enabled: undefined }),
          ],
        }),
      ),
    );

    const models = await fetchCopilotModels({
      baseUrl: 'https://api.individual.githubcopilot.com',
      bearerToken: 'copilot-bearer',
    });

    expect(models.map(m => m.id)).toEqual(['visible']);
  });

  it('filters out entries with policy.state === "disabled" but keeps unconfigured/missing policies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [
            modelEntry({ id: 'allowed' }),
            modelEntry({ id: 'unconfigured', policy: { state: 'unconfigured' } }),
            modelEntry({ id: 'enabled', policy: { state: 'enabled' } }),
            modelEntry({ id: 'disabled', policy: { state: 'disabled' } }),
          ],
        }),
      ),
    );

    const models = await fetchCopilotModels({
      baseUrl: 'https://api.individual.githubcopilot.com',
      bearerToken: 'copilot-bearer',
    });

    expect(models.map(m => m.id).sort()).toEqual(['allowed', 'enabled', 'unconfigured']);
  });

  it('captures supported_endpoints and flags /v1/messages-shaped models as Anthropic-shaped', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [
            modelEntry({ id: 'gpt-4.1', supported_endpoints: ['/chat/completions'] }),
            modelEntry({ id: 'claude-sonnet-4.5', supported_endpoints: ['/v1/messages'] }),
            modelEntry({ id: 'legacy', supported_endpoints: undefined }),
          ],
        }),
      ),
    );

    const models = await fetchCopilotModels({
      baseUrl: 'https://api.individual.githubcopilot.com',
      bearerToken: 'copilot-bearer',
    });

    const byId = Object.fromEntries(models.map(m => [m.id, m]));
    expect(byId['gpt-4.1']?.supportedEndpoints).toEqual(['/chat/completions']);
    expect(byId['gpt-4.1']?.isAnthropicShaped).toBe(false);
    expect(byId['claude-sonnet-4.5']?.supportedEndpoints).toEqual(['/v1/messages']);
    expect(byId['claude-sonnet-4.5']?.isAnthropicShaped).toBe(true);
    // Missing supported_endpoints normalizes to an empty array; the catalog
    // filter treats this as "legacy/compatible" and keeps it.
    expect(byId['legacy']?.supportedEndpoints).toEqual([]);
    expect(byId['legacy']?.isAnthropicShaped).toBe(false);
  });

  it('throws when the API returns a non-2xx status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('forbidden', { status: 403, statusText: 'Forbidden' })),
    );

    await expect(
      fetchCopilotModels({ baseUrl: 'https://api.individual.githubcopilot.com', bearerToken: 'copilot-bearer' }),
    ).rejects.toThrow(/403 Forbidden/);
  });

  it('throws when the response is missing a `data` array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ models: [] })),
    );

    await expect(
      fetchCopilotModels({ baseUrl: 'https://api.individual.githubcopilot.com', bearerToken: 'copilot-bearer' }),
    ).rejects.toThrow(/missing `data` array/);
  });

  it('forwards the AbortSignal to fetch', async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit): Promise<Response> => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    await fetchCopilotModels({
      baseUrl: 'https://api.individual.githubcopilot.com',
      bearerToken: 'copilot-bearer',
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('githubCopilotOAuthProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes the canonical id and name', () => {
    expect(githubCopilotOAuthProvider.id).toBe('github-copilot');
    expect(githubCopilotOAuthProvider.name).toBe('GitHub Copilot');
  });

  it('exposes the bearer token via getApiKey', () => {
    expect(
      githubCopilotOAuthProvider.getApiKey({
        access: 'copilot-bearer',
        refresh: 'ghu_x',
        expires: Date.now() + 60_000,
      }),
    ).toBe('copilot-bearer');
  });

  it('refreshes via the Copilot internal token endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ token: 'new-bearer', expires_at: 9999999999 }));
    vi.stubGlobal('fetch', fetchMock);

    const next = await githubCopilotOAuthProvider.refreshToken({
      access: 'old-bearer',
      refresh: 'ghu_x',
      expires: 0,
    });

    expect(next.access).toBe('new-bearer');
    expect(next.refresh).toBe('ghu_x');
  });
});
