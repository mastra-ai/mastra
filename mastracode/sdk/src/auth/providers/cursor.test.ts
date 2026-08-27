import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOAuthProviders } from '../storage.js';
import {
  cursorOAuthProvider,
  cursorTokenExpiry,
  generateCursorAuthParams,
  loginCursor,
  pollCursorAuth,
  refreshCursorToken,
} from './cursor.js';

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

describe('generateCursorAuthParams', () => {
  it('builds a loginDeepControl URL with PKCE fields', async () => {
    const params = await generateCursorAuthParams();
    const url = new URL(params.loginUrl);
    expect(url.origin + url.pathname).toBe('https://cursor.com/loginDeepControl');
    expect(url.searchParams.get('mode')).toBe('login');
    expect(url.searchParams.get('redirectTarget')).toBe('cli');
    expect(url.searchParams.get('uuid')).toBe(params.uuid);
    expect(url.searchParams.get('challenge')).toBeTruthy();
    expect(params.verifier).toBeTruthy();
  });
});

describe('cursorTokenExpiry', () => {
  it('reads exp from a JWT payload', () => {
    const payload = btoa(JSON.stringify({ exp: 2_000_000_000 })).replace(/\+/g, '-').replace(/\//g, '_');
    const token = `hdr.${payload}.sig`;
    expect(cursorTokenExpiry(token)).toBe(2_000_000_000 * 1000 - 5 * 60 * 1000);
  });
});

describe('pollCursorAuth', () => {
  it('returns tokens after a 404 then a success', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(
      jsonResponse({ accessToken: 'at', refreshToken: 'rt' }),
    );

    const tokens = await pollCursorAuth('u', 'v', undefined, 0);
    expect(tokens).toEqual({ accessToken: 'at', refreshToken: 'rt' });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('uuid=u');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('verifier=v');
  });

  it('throws after three consecutive poll errors', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(pollCursorAuth('u', 'v', undefined, 0)).rejects.toThrow(/Too many consecutive errors/);
  });
});

describe('loginCursor', () => {
  it('opens the browser URL and stores polled tokens', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken: 'at', refreshToken: 'rt' }));
    const onAuth = vi.fn();
    const onProgress = vi.fn();
    const credentials = await loginCursor({ onAuth, onProgress, onPrompt: async () => '' }, { pollDelayMs: 0 });
    expect(onAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('https://cursor.com/loginDeepControl'),
      }),
    );
    expect(credentials.access).toBe('at');
    expect(credentials.refresh).toBe('rt');
    expect(credentials.expires).toBeGreaterThan(0);
  });
});

describe('refreshCursorToken', () => {
  it('posts the refresh token and returns a new access token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken: 'new-at', refreshToken: 'new-rt' }));
    const next = await refreshCursorToken({ access: 'old-at', refresh: 'old-rt', expires: 1 });
    expect(next.access).toBe('new-at');
    expect(next.refresh).toBe('new-rt');
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api2.cursor.sh/auth/exchange_user_api_key');
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer old-rt',
    });
  });

  it('keeps the previous refresh token when Cursor does not rotate it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ accessToken: 'new-at' }));
    const next = await refreshCursorToken({ access: 'old-at', refresh: 'old-rt', expires: 1 });
    expect(next.refresh).toBe('old-rt');
  });
});

describe('cursorOAuthProvider', () => {
  it('exposes the Cursor provider id and access token', () => {
    expect(cursorOAuthProvider.id).toBe('cursor');
    expect(cursorOAuthProvider.name).toBe('Cursor');
    expect(cursorOAuthProvider.getApiKey({ access: 'at', refresh: 'rt', expires: 0 })).toBe('at');
  });

  it('stays out of the user-facing provider registry until model transport exists', () => {
    expect(getOAuthProviders().map(provider => provider.id)).not.toContain('cursor');
  });
});
