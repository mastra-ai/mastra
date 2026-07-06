import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OAuthCredentials } from '../../auth/types.js';
import {
  __testing,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  refreshSlackToken,
  slackOAuthProvider,
} from '../oauth.js';

describe('buildAuthorizeUrl', () => {
  it('builds a PKCE authorize URL with user_scope and S256', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client-123',
        redirectUri: 'http://localhost:41927/callback',
        scopes: ['search:read.public', 'chat:write'],
        challenge: 'the-challenge',
        state: 'the-state',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://slack.com/oauth/v2/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    // Slack requests user-token scopes via user_scope (not scope).
    expect(url.searchParams.get('user_scope')).toBe('search:read.public,chat:write');
    expect(url.searchParams.get('scope')).toBeNull();
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:41927/callback');
    expect(url.searchParams.get('code_challenge')).toBe('the-challenge');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('the-state');
  });
});

describe('parseAuthorizationInput', () => {
  const parse = __testing.parseAuthorizationInput;

  it('extracts code and state from a redirect URL', () => {
    expect(parse('http://localhost:41927/callback?code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('extracts code and state from a query string', () => {
    expect(parse('code=abc&state=xyz')).toEqual({ code: 'abc', state: 'xyz' });
  });

  it('treats a bare value as a raw code', () => {
    expect(parse('  raw-code  ')).toEqual({ code: 'raw-code' });
  });

  it('returns empty for blank input', () => {
    expect(parse('   ')).toEqual({});
  });
});

describe('tokenResponseToCredentials', () => {
  const map = __testing.tokenResponseToCredentials;

  it('maps the authed_user token and team into credentials', () => {
    const before = Date.now();
    const cred = map(
      {
        ok: true,
        team: { id: 'T1', name: 'Acme' },
        authed_user: { id: 'U1', access_token: 'xoxp-1', refresh_token: 'ref-1', expires_in: 3600 },
      },
      'client-123',
    );
    expect(cred.access).toBe('xoxp-1');
    expect(cred.refresh).toBe('ref-1');
    expect(cred.clientId).toBe('client-123');
    expect(cred.teamId).toBe('T1');
    expect(cred.teamName).toBe('Acme');
    expect(cred.userId).toBe('U1');
    expect(cred.expires).toBeGreaterThanOrEqual(before + 3600 * 1000);
  });

  it('keeps the previous refresh token when Slack omits one', () => {
    const cred = map({ ok: true, authed_user: { access_token: 'xoxp-2' } }, 'client-123', {
      refresh: 'old-refresh',
      teamId: 'T9',
      teamName: 'Old',
    });
    expect(cred.refresh).toBe('old-refresh');
    expect(cred.teamId).toBe('T9');
    expect(cred.teamName).toBe('Old');
  });

  it('throws when ok is false', () => {
    expect(() => map({ ok: false, error: 'invalid_grant' }, 'c')).toThrow(/invalid_grant/);
  });

  it('throws when the user token is missing', () => {
    expect(() => map({ ok: true, authed_user: {} }, 'c')).toThrow(/missing user access token/);
  });
});

describe('exchangeAuthorizationCode', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs a PKCE authorization_code grant with NO client_secret', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, authed_user: { access_token: 'xoxp-9', expires_in: 3600 } }),
    });

    await exchangeAuthorizationCode({
      code: 'the-code',
      verifier: 'the-verifier',
      redirectUri: 'http://localhost:41927/callback',
      clientId: 'client-123',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://slack.com/api/oauth.v2.access');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('redirect_uri')).toBe('http://localhost:41927/callback');
    // Public client: never sends a secret.
    expect(body.has('client_secret')).toBe(false);
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(
      exchangeAuthorizationCode({ code: 'c', verifier: 'v', redirectUri: 'r', clientId: 'id' }),
    ).rejects.toThrow(/HTTP 500/);
  });
});

describe('refreshSlackToken', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs a refresh_token grant with the stored client_id and NO secret', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        authed_user: { access_token: 'xoxp-new', refresh_token: 'ref-new', expires_in: 3600 },
      }),
    });

    const cred: OAuthCredentials = {
      access: 'xoxp-old',
      refresh: 'ref-old',
      expires: 1,
      clientId: 'client-abc',
    };
    const next = await refreshSlackToken(cred);

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('ref-old');
    expect(body.get('client_id')).toBe('client-abc');
    expect(body.has('client_secret')).toBe(false);
    expect(next.access).toBe('xoxp-new');
    expect(next.refresh).toBe('ref-new');
  });

  it('throws when there is no refresh token stored', async () => {
    await expect(refreshSlackToken({ access: 'a', refresh: '', expires: 1, clientId: 'client-abc' })).rejects.toThrow(
      /no refresh token/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when no client_id can be resolved', async () => {
    await expect(refreshSlackToken({ access: 'a', refresh: 'r', expires: 1 })).rejects.toThrow(/no client_id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('slackOAuthProvider', () => {
  it('is a callback-server provider that returns the access token as the api key', () => {
    expect(slackOAuthProvider.id).toBe('slack');
    expect(slackOAuthProvider.usesCallbackServer).toBe(true);
    expect(slackOAuthProvider.getApiKey({ access: 'xoxp-key', refresh: 'r', expires: 1 })).toBe('xoxp-key');
  });
});
