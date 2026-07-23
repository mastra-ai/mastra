import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { SlackUserCredentials } from './credential-storage';
import { InMemorySlackCredentialStorage } from './credential-storage';
import { buildAuthorizeUrl, parseAuthorizationInput, tokenResponseToCredentials } from './oauth';
import { SlackAuthReconnectRequiredError, SlackAuthRequiredError, SlackUserAuth } from './user-auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Real `refresh_token` grant response shape (verified against the live API):
 * the rotated user token comes back at the TOP level with `token_type: "user"`
 * — there is no `authed_user` nesting like the initial code exchange.
 */
function refreshResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    ok: true,
    access_token: 'xoxe.xoxp-refreshed',
    refresh_token: 'xoxe-1-rotated',
    expires_in: 43200,
    token_type: 'user',
    user_id: 'U1',
    team: { id: 'T1', name: 'Team One' },
    ...overrides,
  });
}

function liveCredentials(overrides: Partial<SlackUserCredentials> = {}): SlackUserCredentials {
  return {
    accessToken: 'xoxp-live',
    refreshToken: 'xoxe-1-old',
    expiresAt: Date.now() + 60 * 60 * 1000, // 1h out
    clientId: 'client-123',
    teamId: 'T1',
    teamName: 'Team One',
    userId: 'U1',
    ...overrides,
  };
}

function expiredCredentials(overrides: Partial<SlackUserCredentials> = {}): SlackUserCredentials {
  return liveCredentials({ expiresAt: Date.now() - 1000, ...overrides });
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SlackUserAuth.getToken', () => {
  it('throws SlackAuthRequiredError when no credentials are stored', async () => {
    const auth = new SlackUserAuth({ storage: new InMemorySlackCredentialStorage() });
    await expect(auth.getToken()).rejects.toBeInstanceOf(SlackAuthRequiredError);
  });

  it('returns the stored token when not near expiry (no refresh)', async () => {
    const storage = new InMemorySlackCredentialStorage(liveCredentials());
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).resolves.toBe('xoxp-live');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refreshes proactively when within the refresh skew', async () => {
    const storage = new InMemorySlackCredentialStorage(
      liveCredentials({ expiresAt: Date.now() + 60 * 1000 }), // 1 min out, default skew 5 min
    );
    mockFetch.mockResolvedValueOnce(refreshResponse());
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).resolves.toBe('xoxe.xoxp-refreshed');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('persists the rotated refresh token before returning', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    mockFetch.mockResolvedValueOnce(refreshResponse());
    const auth = new SlackUserAuth({ storage });

    await auth.getToken();

    const stored = await storage.load();
    expect(stored?.accessToken).toBe('xoxe.xoxp-refreshed');
    expect(stored?.refreshToken).toBe('xoxe-1-rotated');
    expect(stored?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('sends grant_type=refresh_token with the stored client_id and no secret', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    mockFetch.mockResolvedValueOnce(refreshResponse());
    const auth = new SlackUserAuth({ storage });

    await auth.getToken();

    const body = mockFetch.mock.calls[0]![1]!.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('refresh_token')).toBe('xoxe-1-old');
    expect(body.get('client_secret')).toBeNull();
  });

  it('keeps the previous refresh token when the response omits one', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        access_token: 'xoxp-new',
        expires_in: 43200,
        token_type: 'user',
        user_id: 'U1',
      }),
    );
    const auth = new SlackUserAuth({ storage });

    await auth.getToken();

    const stored = await storage.load();
    expect(stored?.refreshToken).toBe('xoxe-1-old');
  });

  it('also accepts a refresh response nested under authed_user (code-exchange shape)', async () => {
    // Defensive: the initial code exchange nests the user token; tolerate both.
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        team: { id: 'T1', name: 'Team One' },
        authed_user: {
          id: 'U1',
          access_token: 'xoxe.xoxp-nested',
          refresh_token: 'xoxe-1-nested-rotated',
          expires_in: 43200,
          token_type: 'user',
        },
      }),
    );
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).resolves.toBe('xoxe.xoxp-nested');
    const stored = await storage.load();
    expect(stored?.refreshToken).toBe('xoxe-1-nested-rotated');
  });

  it('dedupes concurrent refreshes into a single rotation', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    let resolveFetch!: (r: Response) => void;
    mockFetch.mockReturnValueOnce(new Promise<Response>(r => (resolveFetch = r)));
    const auth = new SlackUserAuth({ storage });

    const [a, b] = [auth.getToken(), auth.getToken()];
    resolveFetch(refreshResponse());

    await expect(a).resolves.toBe('xoxe.xoxp-refreshed');
    await expect(b).resolves.toBe('xoxe.xoxp-refreshed');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('re-reads storage before refreshing (another process already rotated)', async () => {
    // First load (getToken) sees expired creds; the re-read inside the
    // refresh path sees fresh creds rotated by another process.
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    const loads = [expiredCredentials(), liveCredentials({ accessToken: 'xoxp-rotated-elsewhere' })];
    vi.spyOn(storage, 'load').mockImplementation(async () => loads.shift());
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).resolves.toBe('xoxp-rotated-elsewhere');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('marks credentials needsReconnect and throws when the refresh token is dead', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'invalid_refresh_token' }));
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).rejects.toBeInstanceOf(SlackAuthReconnectRequiredError);
    const stored = await storage.load();
    expect(stored?.needsReconnect).toBe(true);

    // Subsequent calls fail fast without hitting Slack again.
    mockFetch.mockClear();
    await expect(auth.getToken()).rejects.toBeInstanceOf(SlackAuthReconnectRequiredError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not flag needsReconnect on transient HTTP failures', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials());
    mockFetch.mockResolvedValueOnce(new Response('gateway timeout', { status: 504 }));
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).rejects.toThrow('HTTP 504');
    const stored = await storage.load();
    expect(stored?.needsReconnect).toBeUndefined();
  });

  it('returns a non-rotating token as-is even when expiresAt has passed', async () => {
    const storage = new InMemorySlackCredentialStorage(expiredCredentials({ refreshToken: undefined }));
    const auth = new SlackUserAuth({ storage });

    await expect(auth.getToken()).resolves.toBe('xoxp-live');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('SlackUserAuth static token mode', () => {
  it('returns the static token without touching storage or network', async () => {
    const storage = new InMemorySlackCredentialStorage();
    const loadSpy = vi.spyOn(storage, 'load');
    const auth = new SlackUserAuth({ token: 'xoxp-static', storage });

    await expect(auth.getToken()).resolves.toBe('xoxp-static');
    expect(loadSpy).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resolves userId via auth.test and caches it', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true, user_id: 'U42' }));
    const auth = new SlackUserAuth({ token: 'xoxp-static' });

    await expect(auth.getUserId()).resolves.toBe('U42');
    await expect(auth.getUserId()).resolves.toBe('U42');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('SlackUserAuth.getStatus', () => {
  it('reports disconnected when nothing is stored', async () => {
    const auth = new SlackUserAuth({ storage: new InMemorySlackCredentialStorage() });
    await expect(auth.getStatus()).resolves.toEqual({ connected: false, needsReconnect: false });
  });

  it('reports needsReconnect from stored credentials', async () => {
    const storage = new InMemorySlackCredentialStorage(liveCredentials({ needsReconnect: true }));
    const auth = new SlackUserAuth({ storage });

    const status = await auth.getStatus();
    expect(status.connected).toBe(false);
    expect(status.needsReconnect).toBe(true);
    expect(status.teamName).toBe('Team One');
  });

  it('reports connected with team/user details', async () => {
    const storage = new InMemorySlackCredentialStorage(liveCredentials());
    const auth = new SlackUserAuth({ storage });

    const status = await auth.getStatus();
    expect(status.connected).toBe(true);
    expect(status.userId).toBe('U1');
  });
});

describe('oauth helpers', () => {
  it('buildAuthorizeUrl uses user_scope and PKCE params', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'cid',
        redirectUri: 'http://localhost:41927/callback',
        scopes: ['im:history', 'users:read'],
        challenge: 'chal',
        state: 'st',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize');
    expect(url.searchParams.get('user_scope')).toBe('im:history,users:read');
    expect(url.searchParams.get('scope')).toBeNull();
    expect(url.searchParams.get('code_challenge')).toBe('chal');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('parseAuthorizationInput handles URLs, query strings, and raw codes', () => {
    expect(parseAuthorizationInput('http://localhost:41927/callback?code=abc&state=st')).toEqual({
      code: 'abc',
      state: 'st',
    });
    expect(parseAuthorizationInput('code=abc&state=st')).toEqual({ code: 'abc', state: 'st' });
    expect(parseAuthorizationInput('rawcode')).toEqual({ code: 'rawcode' });
    expect(parseAuthorizationInput('')).toEqual({});
  });

  it('tokenResponseToCredentials maps the authed_user payload', () => {
    const credentials = tokenResponseToCredentials(
      {
        ok: true,
        team: { id: 'T9', name: 'Nine' },
        authed_user: { id: 'U9', access_token: 'xoxp-9', refresh_token: 'xoxe-9', expires_in: 100 },
      },
      'cid',
    );
    expect(credentials.accessToken).toBe('xoxp-9');
    expect(credentials.refreshToken).toBe('xoxe-9');
    expect(credentials.clientId).toBe('cid');
    expect(credentials.teamId).toBe('T9');
    expect(credentials.userId).toBe('U9');
    expect(credentials.expiresAt).toBeGreaterThan(Date.now());
  });

  it('tokenResponseToCredentials throws on error payloads', () => {
    expect(() => tokenResponseToCredentials({ ok: false, error: 'access_denied' }, 'cid')).toThrow(
      'Slack OAuth failed: access_denied',
    );
  });
});
