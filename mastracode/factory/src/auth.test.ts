import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFactoryAuthOrgId,
  getFactoryAuthUser,
  getFactoryAuthUserId,
  mountFactoryAuth,
  factoryAuthTenant,
} from './auth.js';

// Mock @mastra/auth-workos so the tests exercise the gating/routing logic in
// this module without constructing a real WorkOS client. `authenticateToken`'s
// behavior is swapped per-test via `mockAuthenticate`.
const mockAuthenticate = vi.fn();
const mockGetLoginUrl = vi.fn((_redirectUri: string, _state: string) => 'https://workos.example/login');
const mockHandleCallback = vi.fn(async () => ({ user: { email: 'a@b.com' }, cookies: ['wos_session=sealed; Path=/'] }));
const mockGetLogoutUrl = vi.fn(async () => 'https://workos.example/logout');
const mockGetClearSessionHeaders = vi.fn(() => ({ 'Set-Cookie': 'wos_session=; Path=/; HttpOnly; Max-Age=0' }));
// Personal-org bootstrap (IOrganizationsProvider). The WorkOS-specific
// bootstrap mechanics live in @mastra/auth-workos and are covered there; here
// the mock models "no org → org_new".
const mockEnsureOrganization = vi.fn(async (_userId: string) => 'org_new');
const mockIsOrganizationAdmin = vi.fn(async () => false);

vi.mock('@mastra/auth-workos', () => ({
  MastraAuthWorkos: class {
    name = 'workos';
    getLoginUrl = mockGetLoginUrl;
    handleCallback = mockHandleCallback;
    authenticateToken = mockAuthenticate;
    authorizeUser = async () => true;
    getLogoutUrl = mockGetLogoutUrl;
    getClearSessionHeaders = mockGetClearSessionHeaders;
    ensureOrganization = mockEnsureOrganization;
    isOrganizationAdmin = mockIsOrganizationAdmin;
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
  // Restore default mock behavior after clearAllMocks wipes it.
  mockGetLoginUrl.mockReturnValue('https://workos.example/login');
  mockHandleCallback.mockResolvedValue({ user: { email: 'a@b.com' }, cookies: ['wos_session=sealed; Path=/'] });
  mockGetLogoutUrl.mockResolvedValue('https://workos.example/logout');
  mockGetClearSessionHeaders.mockReturnValue({ 'Set-Cookie': 'wos_session=; Path=/; HttpOnly; Max-Age=0' });
  mockEnsureOrganization.mockResolvedValue('org_new');
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Build a gated app where the protected catch-all returns 200 "ok". */
function buildApp() {
  const app = new Hono();
  const enabled = mountFactoryAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
  app.get('*', c => c.text('ok'));
  app.post('*', c => c.text('ok'));
  return { app, enabled };
}

describe('env-implied WorkOS fallback', () => {
  it('leaves auth disabled when env vars are missing', () => {
    expect(mountFactoryAuth(new Hono())).toBe(false);
  });

  it('leaves auth disabled when only one env var is set', () => {
    process.env.WORKOS_API_KEY = 'sk_test';
    expect(mountFactoryAuth(new Hono())).toBe(false);
  });

  it('enables auth when both env vars are set', () => {
    enableEnv();
    expect(mountFactoryAuth(new Hono())).toBe(true);
  });
});

describe('mountFactoryAuth (disabled)', () => {
  it('is a no-op and leaves routes ungated', async () => {
    const { app, enabled } = buildApp();
    expect(enabled).toBe(false);

    const res = await app.request('/api/anything', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

describe('mountFactoryAuth gate (enabled)', () => {
  beforeEach(enableEnv);

  it('redirects unauthenticated HTML navigation to /signin with returnTo', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/some/page', { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('/signin?returnTo=')).toBe(true);
    expect(decodeURIComponent(location.split('returnTo=')[1]!)).toBe('/some/page');
  });

  it('lets unauthenticated HTML navigation reach /signin so the SPA can render the sign-in page', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/signin?returnTo=%2Fchat', { headers: { Accept: 'text/html' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('lets unauthenticated requests fetch static assets needed by the sign-in page', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/assets/app.js', { headers: { Accept: '*/*' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('returns 401 JSON for unauthenticated /api requests', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  it('lets unauthenticated GitHub webhook deliveries reach the route handler', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/web/github/webhook', { method: 'POST', headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('does not bypass auth for non-POST GitHub webhook requests', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();

    const res = await app.request('/web/github/webhook', { method: 'GET', headers: { Accept: 'application/json' } });
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
    mockAuthenticate.mockResolvedValue({ workosId: 'user_ok', email: 'user@example.com', name: 'User' });
    const { app } = buildApp();

    const res = await app.request('/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('treats a provider result without a stable user id as unauthenticated', async () => {
    // Downstream tenancy scopes rows by user id; a session that cannot yield
    // one must not pass the gate.
    mockAuthenticate.mockResolvedValue({ email: 'user@example.com', name: 'User' });
    const { app } = buildApp();

    const res = await app.request('/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('treats a thrown provider error as unauthenticated', async () => {
    mockAuthenticate.mockRejectedValue(new Error('boom'));
    const { app } = buildApp();

    const res = await app.request('/web/projects', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(401);
  });

  it('stashes the authenticated user on the context for downstream routes', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_123', email: 'user@example.com', name: 'User' });
    const app = new Hono();
    mountFactoryAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/web/whoami', c => {
      const user = getFactoryAuthUser(c);
      return c.json({ userId: getFactoryAuthUserId(user) });
    });

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_123' });
  });
});

describe('mountFactoryAuth /auth routes (enabled)', () => {
  beforeEach(enableEnv);

  it('redirects /auth/login to the WorkOS login URL', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/login');
    expect(mockGetLoginUrl).toHaveBeenCalledOnce();
  });

  it('encodes returnTo into pipe-format state (MastraAuthStudio contract)', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=/dashboard');
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    const pipeIndex = state.indexOf('|');
    expect(pipeIndex).toBeGreaterThan(0);
    expect(decodeURIComponent(state.slice(pipeIndex + 1))).toBe('/dashboard');
  });

  it('stashes returnTo in a short-lived cookie across the login round-trip', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/login?returnTo=/dashboard');
    expect(res.headers.get('set-cookie')).toContain('mastra_factory_return_to=%2Fdashboard');
  });

  it('rejects external returnTo in login (open-redirect protection)', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=https://evil.com');
    // The encoded state must carry the sanitized "/" path, not the external URL.
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    expect(decodeURIComponent(state.split('|')[1]!)).toBe('/');
  });

  it('rejects protocol-relative returnTo', async () => {
    const { app } = buildApp();
    await app.request('/auth/login?returnTo=//evil.com');
    const state = mockGetLoginUrl.mock.calls[0]![1] as string;
    expect(decodeURIComponent(state.split('|')[1]!)).toBe('/');
  });

  it('handles the callback, applies cookies, and redirects to decoded returnTo', async () => {
    const { app } = buildApp();
    const state = `uuid-1|${encodeURIComponent('/dashboard')}`;
    const res = await app.request(`/auth/callback?code=abc&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/dashboard');
    expect(res.headers.get('set-cookie')).toContain('wos_session=sealed');
    // Hono percent-decodes query values, so the provider sees the raw pipe form.
    expect(mockHandleCallback).toHaveBeenCalledWith('abc', 'uuid-1|/dashboard');
  });

  it('falls back to the returnTo cookie when the callback has no state', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/callback?code=abc', {
      headers: { Cookie: 'mastra_factory_return_to=%2Fconnect%2Fslack%3Fstate%3Dsigned' },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/connect/slack?state=signed');
    // The stash cookie must be cleared once consumed.
    expect(res.headers.get('set-cookie')).toContain('mastra_factory_return_to=;');
  });

  it('rejects an external URL smuggled into the returnTo cookie', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/callback?code=abc', {
      headers: { Cookie: `mastra_factory_return_to=${encodeURIComponent('https://evil.com')}` },
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  it('redirects callback back to login when code is missing', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/callback');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
    expect(mockHandleCallback).not.toHaveBeenCalled();
  });

  it('redirects callback back to login when the code exchange fails', async () => {
    mockHandleCallback.mockRejectedValue(new Error('expired code'));
    const { app } = buildApp();
    const state = `uuid-1|${encodeURIComponent('/dashboard')}`;
    const res = await app.request(`/auth/callback?code=bad&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/auth/login');
  });

  it('logout clears the session cookie and redirects to the WorkOS logout URL', async () => {
    const { app } = buildApp();
    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://workos.example/logout');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('logout still clears the session cookie when the provider has no logout URL', async () => {
    mockGetLogoutUrl.mockRejectedValue(new Error('no session'));
    const { app } = buildApp();
    const res = await app.request('/auth/logout');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('/auth/me reports authenticated:false when no session', async () => {
    mockAuthenticate.mockResolvedValue(null);
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ authenticated: false, user: null, provider: 'workos' });
  });

  it('/auth/me reports the user when authenticated', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_me', email: 'user@example.com', name: 'User' });
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      // No-org accounts are bootstrapped into a personal org during /auth/me.
      user: { userId: 'user_me', email: 'user@example.com', name: 'User', organizationId: 'org_new' },
      provider: 'workos',
    });
    expect(mockEnsureOrganization).toHaveBeenCalledWith('user_me');
  });

  it('/auth/me surfaces the organization id and stable user id to the SPA', async () => {
    mockAuthenticate.mockResolvedValue({
      workosId: 'user_1',
      email: 'user@example.com',
      name: 'User',
      organizationId: 'org_a',
    });
    const { app } = buildApp();
    const res = await app.request('/auth/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      authenticated: true,
      user: { email: 'user@example.com', name: 'User', organizationId: 'org_a', userId: 'user_1' },
      provider: 'workos',
    });
    expect(mockEnsureOrganization).not.toHaveBeenCalled();
  });
});

describe('org-tenant identity', () => {
  beforeEach(enableEnv);

  it('getFactoryAuthOrgId reads the organization id from the user shape', () => {
    expect(getFactoryAuthOrgId({ workosId: 'user_1', organizationId: 'org_a' })).toBe('org_a');
    expect(getFactoryAuthOrgId({ workosId: 'user_1' })).toBeUndefined();
    expect(getFactoryAuthOrgId(undefined)).toBeUndefined();
  });

  it('gate stashes organizationId and factoryAuthTenant returns { orgId, userId }', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_1', organizationId: 'org_a', email: 'u@e.com' });
    const app = new Hono();
    mountFactoryAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/web/whoami', c => c.json(factoryAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: 'org_a', userId: 'user_1' });
    // The user already has an org — no bootstrap round-trip.
    expect(mockEnsureOrganization).not.toHaveBeenCalled();
  });

  it('gate bootstraps a no-org user so factoryAuthTenant yields the new org', async () => {
    mockAuthenticate.mockResolvedValue({ workosId: 'user_boot', email: 'boot@example.com' });
    const app = new Hono();
    mountFactoryAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/web/whoami', c => c.json(factoryAuthTenant(c) ?? { tenant: null }));

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: 'org_new', userId: 'user_boot' });
    expect(mockEnsureOrganization).toHaveBeenCalledWith('user_boot');
  });

  it('factoryAuthTenant omits orgId for personal (no-org) users but keeps userId', async () => {
    // Bootstrap is best-effort: when org creation fails, the user genuinely
    // stays no-org, so the tenant must still expose a userId without an orgId.
    mockEnsureOrganization.mockResolvedValue(undefined as unknown as string);
    mockAuthenticate.mockResolvedValue({ workosId: 'user_solo', email: 'solo@e.com' });
    const app = new Hono();
    mountFactoryAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/web/whoami', c => {
      const tenant = factoryAuthTenant(c);
      return c.json({ orgId: tenant?.orgId ?? null, userId: tenant?.userId ?? null });
    });

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: null, userId: 'user_solo' });
  });

  it('a thrown bootstrap error leaves the user no-org instead of failing the request', async () => {
    mockEnsureOrganization.mockRejectedValue(new Error('workos unavailable'));
    mockAuthenticate.mockResolvedValue({ workosId: 'user_err', email: 'err@e.com' });
    const app = new Hono();
    mountFactoryAuth(app, { redirectUri: 'http://localhost:4111/auth/callback' });
    app.get('/web/whoami', c => {
      const tenant = factoryAuthTenant(c);
      return c.json({ orgId: tenant?.orgId ?? null, userId: tenant?.userId ?? null });
    });

    const res = await app.request('/web/whoami', { headers: { Accept: 'application/json' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orgId: null, userId: 'user_err' });
  });
});
