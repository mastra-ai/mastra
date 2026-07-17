import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeAnthropicLogin, loginAnthropic, refreshAnthropicToken, startAnthropicLogin } from './anthropic.js';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('startAnthropicLogin', () => {
  it('builds an authorization URL with PKCE and returns the verifier', async () => {
    const { url, verifier } = await startAnthropicLogin();
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://claude.ai');
    expect(parsed.pathname).toBe('/oauth/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://console.anthropic.com/oauth/code/callback');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('code_challenge')).toBeTruthy();
    expect(parsed.searchParams.get('state')).toBe(verifier);
    expect(verifier.length).toBeGreaterThan(20);
  });

  it('generates a fresh verifier per call', async () => {
    const first = await startAnthropicLogin();
    const second = await startAnthropicLogin();
    expect(first.verifier).not.toBe(second.verifier);
  });
});

describe('completeAnthropicLogin', () => {
  it('exchanges a code#state paste for credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));

    const before = Date.now();
    const creds = await completeAnthropicLogin('the-code#the-verifier', 'the-verifier');

    expect(creds.access).toBe('at');
    expect(creds.refresh).toBe('rt');
    // 1h minus 5-minute buffer
    expect(creds.expires).toBeGreaterThanOrEqual(before + 3600_000 - 300_000);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://console.anthropic.com/v1/oauth/token');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      grant_type: 'authorization_code',
      code: 'the-code',
      state: 'the-verifier',
      code_verifier: 'the-verifier',
    });
  });

  it('accepts a full redirect URL paste', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));

    await completeAnthropicLogin('https://console.anthropic.com/oauth/code/callback?code=abc&state=v', 'v');

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.code).toBe('abc');
    expect(body.state).toBe('v');
  });

  it('rejects missing or mismatched state before token exchange', async () => {
    await expect(completeAnthropicLogin('bare-code', 'the-verifier')).rejects.toThrow('Invalid authorization state');
    await expect(completeAnthropicLogin('code#wrong-state', 'the-verifier')).rejects.toThrow(
      'Invalid authorization state',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on empty input', async () => {
    await expect(completeAnthropicLogin('   ', 'v')).rejects.toThrow('Missing authorization code');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws with the response body when the exchange fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('invalid_grant', { status: 400 }));
    await expect(completeAnthropicLogin('code#v', 'v')).rejects.toThrow('Token exchange failed: invalid_grant');
  });
});

describe('loginAnthropic', () => {
  it('runs the full paste-code flow on top of the primitives', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }));

    let seenUrl: string | undefined;
    const creds = await loginAnthropic(
      url => {
        seenUrl = url;
      },
      async () => `code#${new URL(seenUrl!).searchParams.get('state')}`,
    );

    expect(seenUrl).toContain('https://claude.ai/oauth/authorize');
    expect(creds.access).toBe('at');

    // The verifier sent to the token endpoint matches the state in the auth URL.
    const authState = new URL(seenUrl!).searchParams.get('state');
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.code_verifier).toBe(authState);
  });
});

describe('refreshAnthropicToken', () => {
  it('exchanges the refresh token', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 }),
    );

    const creds = await refreshAnthropicToken('old-rt');
    expect(creds.access).toBe('new-at');
    expect(creds.refresh).toBe('new-rt');

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'old-rt' });
  });

  it('throws with the response body on failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad refresh', { status: 400 }));
    await expect(refreshAnthropicToken('rt')).rejects.toThrow('Anthropic token refresh failed: bad refresh');
  });
});
