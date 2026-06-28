import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getWebAuthUser, getWebAuthUserId, isWebAuthEnabled, mountWebAuth } from './auth.js';

// Mock @mastra/auth-workos so the tests exercise the gating/routing logic in
// this module without constructing a real WorkOS client. `authenticateToken`'s
// behavior is swapped per-test via `mockAuthenticate`.
const mockAuthenticate = vi.fn();
const mockGetLoginUrl = vi.fn((_redirectUri: string, _state: string) => 'https://workos.example/login');
const mockHandleCallback = vi.fn(async () => ({ user: { email: 'a@b.com' }, cookies: ['wos_session=sealed; Path=/'] }));
const mockGetLogoutUrl = vi.fn(async () => 'https://workos.example/logout');

vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {
    getLoginUrl = mockGetLoginUrl;
    handleCallback = mockHandleCallback;
    authenticateToken = mockAuthenticate;
    getLogoutUrl = mockGetLogoutUrl;
  },
}));

const ORIGINAL_ENV = { ...process.env };

function enableEnv() {
  process.env.WORKOS_API_KEY = 'sk_test';
  process.env.WORKOS_CLIENT_ID = 'client_test';
}

function disableEnv() {
  delete process.env.WORKOS_API_KEY;
  delete process.env.WORKOS_CLIENT_ID;
  delete process.env.WORKOS_REDIRECT_URI;
}

beforeEach(() => {
  vi.clearAllMocks();
  disableEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Build a gated app where the protected catch-all returns 200 "ok". */
function buildApp() {
  const app = new Hono();
  const enabled = mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
  app.get('*', c => c.text('ok'));
  return { app, enabled };
}

describe('isWebAuthEnabled', () => {
  it('is false when env vars are missing', () => {
    expect(isWebAuthEnabled()).toBe(false);
  });

  it('is false when only one env var is set', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    expect(isWebAuthEnabled()).toBe(false);
  });

  it('is true when both env vars are set', () => {
    enableEnv();
    expect(isWebAuthEnabled()).toBe(true);
  });
});

describe('mountWebAuth (disabled)', () => {
  it('is a no-op and leaves routes ungated', async () => {
    const { app, enabled } = buildApp();
    expect(enabled).toBe(false);

    const res = await app.request('/api/anything', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

describe('mountWebAuth gate (enabled)', () => {
  beforeEach(enableEnv);

  it('redirects unauthenticated HTML navigation to login with returnTo', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/some/page', { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('/auth/login?returnTo=')).toBe(true);
    expect(decodeURIComponent(location.split('returnTo=')[1]!)).toBe('/some/page');
  });

  it('returns 401 JSON for unauthenticated /api requests', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/api/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 for unauthenticated non-HTML navigation (XHR)', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/some/page', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('passes through when the provider authenticates', async () => {
    mockAuthenticate.mockResolvedValue({ email: 'user@example.com', name: 'User' });
    const { app } = buildApp();

    const res = await app.request('/api/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('treats a thrown provider error as unauthenticated', async () => {
    mockAuthenticate.mockRejectedValue(new Error('boom'));
    const { app } = buildApp();

    const res = await app.request('/api/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('stashes the authenticated user on the context for downstream routes', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_123', email: 'user@example.com', name: 'User' });
    const app = new Hono();
    mountWebAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/api/web/whoami', c => {
      const user = getWebAuthUser(c);
      return c.json({ userId: getWebAuthUserId(user) });
    });

    const res = await app.request('/api/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_123' });
  });
});

describe('mountWebAuth /auth routes (enabled)', () => {
  beforeEach(enableEnv);

  it('redirects /auth/login to the WorkOS login URL', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/login');
    expect(mockGetLoginUrl).toHaveBeenCalledOnce();
  });

  it('rejects external returnTo in login (open-redirect protection)', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=https://evil.com');
    // The encoded state must carry the sanitized "/" path, not the external URL.
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    expect(decoded.returnTo).toBe('/');
  });

  it('rejects protocol-relative returnTo', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=//evil.com');
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    expect(decoded.returnTo).toBe('/');
  });

  it('handles the callback, applies cookies, and redirects to decoded returnTo', async () => {
    const { app } = buildApp();
    const state = Buffer.from(JSON.stringify({ returnTo: '/dashboard' }), 'utf8').toString('base64url');
    const res = await app.request(`/auth/callback?code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/dashboard');
    expect(res.headers.get('set-cookie')).toContain('wos_session=sealed');
    expect(mockHandleCallback).toHaveBeenCalledWith('abc', state);
  });

  it('redirects callback back to login when code is missing', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/callback');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
    expect(mockHandleCallback).not.toHaveBeenCalled();
  });

  it('logout clears the session cookie and redirects to the WorkOS logout URL', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/logout');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('/auth/me reports authenticated:false when no session', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false, user: null });
  });

  it('/auth/me reports the user when authenticated', async () => {
    mockAuthenticate.mockResolvedValue({ email: 'user@example.com', name: 'User' });
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: true, user: { email: 'user@example.com', name: 'User' } });
  });
});
